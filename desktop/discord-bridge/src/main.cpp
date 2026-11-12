#define DISCORDPP_IMPLEMENTATION
#include "discordpp.h"

#include <nlohmann/json.hpp>

#include <atomic>
#include <chrono>
#include <cstdint>
#include <deque>
#include <iostream>
#include <memory>
#include <mutex>
#include <optional>
#include <string>
#include <thread>

using json = nlohmann::json;
using Clock = std::chrono::steady_clock;

namespace {

constexpr auto FRIENDS_INTERVAL = std::chrono::milliseconds(1500);
constexpr auto REFRESH_RETRY = std::chrono::seconds(30);
constexpr auto TICK = std::chrono::milliseconds(16);
constexpr size_t MAX_TEXT = 128;

std::mutex inboxMutex;
std::deque<std::string> inbox;
std::atomic<bool> running{true};

void emit(const json &message) {
	std::cout << message.dump(-1, ' ', false, json::error_handler_t::replace)
	          << '\n'
	          << std::flush;
}

void log(const std::string &level, const std::string &message) {
	emit({{"type", "log"}, {"level", level}, {"message", message}});
}

std::optional<uint64_t> parseId(const json &value) {
	if (!value.is_string()) {
		return std::nullopt;
	}
	const auto text = value.get<std::string>();
	if (text.empty() || text.size() > 20 ||
	    text.find_first_not_of("0123456789") != std::string::npos) {
		return std::nullopt;
	}
	try {
		return std::stoull(text);
	} catch (...) {
		return std::nullopt;
	}
}

std::optional<std::string> text(const json &object, const char *key) {
	if (!object.contains(key) || !object[key].is_string()) {
		return std::nullopt;
	}
	auto value = object[key].get<std::string>();
	if (value.empty()) {
		return std::nullopt;
	}
	return value.substr(0, MAX_TEXT);
}

const char *statusName(discordpp::StatusType status) {
	switch (status) {
	case discordpp::StatusType::Online:
		return "online";
	case discordpp::StatusType::Idle:
		return "idle";
	case discordpp::StatusType::Dnd:
		return "dnd";
	case discordpp::StatusType::Streaming:
		return "online";
	default:
		return "offline";
	}
}

json userJson(const discordpp::UserHandle &user) {
	return {
	    {"id", std::to_string(user.Id())},
	    {"username", user.Username()},
	    {"displayName", user.DisplayName()},
	    {"avatarUrl", user.AvatarUrl(discordpp::UserHandle::AvatarType::Png,
	                                 discordpp::UserHandle::AvatarType::Png)},
	    {"status", statusName(user.Status())},
	    {"playing", user.GameActivity().has_value()},
	    {"provisional", user.IsProvisional()},
	};
}

class Bridge {
  public:
	Bridge() : client(std::make_shared<discordpp::Client>()) {}

	void handle(const std::string &line) {
		json message;
		try {
			message = json::parse(line);
		} catch (...) {
			log("warning", "Ordre illisible");
			return;
		}
		if (!message.is_object() || !message.contains("type") ||
		    !message["type"].is_string()) {
			return;
		}
		const auto type = message["type"].get<std::string>();
		try {
			if (type == "init") {
				init(message);
			} else if (!applicationId) {
				log("warning", "Ordre reçu avant init");
			} else if (type == "authorize") {
				authorize();
			} else if (type == "logout") {
				logout();
			} else if (type == "presence") {
				presence(message.contains("activity") ? message["activity"] : json());
			} else if (type == "invite") {
				invite(message);
			}
		} catch (const json::exception &error) {
			log("warning", std::string("Ordre mal formé : ") + error.what());
		}
	}

	void tick() {
		const auto now = Clock::now();
		if (friendsDirty && now - lastFriends >= FRIENDS_INTERVAL) {
			friendsDirty = false;
			lastFriends = now;
			sendFriends();
		}
		if (refreshAt && now >= *refreshAt) {
			refreshAt.reset();
			refresh();
		}
	}

  private:
	std::shared_ptr<discordpp::Client> client;
	uint64_t applicationId = 0;
	std::string refreshToken;
	bool friendsDirty = false;
	bool authorizing = false;
	Clock::time_point lastFriends{};
	std::optional<Clock::time_point> refreshAt;

	void status(const std::string &name, const std::string &error = "") {
		json message = {{"type", "status"}, {"status", name}};
		if (!error.empty()) {
			message["error"] = error;
		}
		emit(message);
	}

	void init(const json &message) {
		if (applicationId) {
			return;
		}
		const auto id = message.contains("applicationId")
		                    ? parseId(message["applicationId"])
		                    : std::nullopt;
		if (!id) {
			status("error", "applicationId manquant");
			return;
		}
		applicationId = *id;
		client->AddLogCallback(
		    [](std::string text, discordpp::LoggingSeverity severity) {
			    log(severity == discordpp::LoggingSeverity::Error ? "error"
			                                                        : "warning",
			        text);
		    },
		    discordpp::LoggingSeverity::Warning);
		client->SetApplicationId(applicationId);
		if (message.contains("launchCommand") &&
		    message["launchCommand"].is_string()) {
			client->RegisterLaunchCommand(applicationId,
			                              message["launchCommand"].get<std::string>());
		}

		client->SetActivityJoinCallback([](std::string secret) {
			emit({{"type", "join"}, {"secret", secret}});
		});
		client->SetStatusChangedCallback([this](discordpp::Client::Status next,
		                                        discordpp::Client::Error error,
		                                        int32_t detail) {
			onStatus(next, error, detail);
		});
		const auto dirty = [this](uint64_t, bool) { friendsDirty = true; };
		client->SetRelationshipCreatedCallback(dirty);
		client->SetRelationshipDeletedCallback(dirty);
		client->SetUserUpdatedCallback([this](uint64_t) { friendsDirty = true; });
		client->SetTokenExpirationCallback([this]() { refresh(); });

		if (message.contains("refreshToken") && message["refreshToken"].is_string() &&
		    !message["refreshToken"].get<std::string>().empty()) {
			refreshToken = message["refreshToken"].get<std::string>();
			refresh();
		} else {
			status("signed-out");
		}
	}

	void onStatus(discordpp::Client::Status next, discordpp::Client::Error error,
	              int32_t detail) {
		using Status = discordpp::Client::Status;
		if (next == Status::Ready) {
			status("ready");
			const auto self = client->GetCurrentUserV2();
			emit({{"type", "user"}, {"user", self ? userJson(*self) : json()}});
			friendsDirty = true;
			lastFriends = {};
			return;
		}
		if (error != discordpp::Client::Error::None) {
			status("error", discordpp::Client::ErrorToString(error) + " (" +
			                    std::to_string(detail) + ")");
			return;
		}
		if (next == Status::Disconnected) {
			status(refreshToken.empty() ? "signed-out" : "connecting");
		} else if (next == Status::Connecting || next == Status::Connected ||
		           next == Status::Reconnecting || next == Status::HttpWait) {
			status("connecting");
		}
	}

	void authorize() {
		if (authorizing || client->GetStatus() == discordpp::Client::Status::Ready) {
			return;
		}
		authorizing = true;
		status("authorizing");
		auto verifier = client->CreateAuthorizationCodeVerifier();
		discordpp::AuthorizationArgs args{};
		args.SetClientId(applicationId);
		args.SetScopes(discordpp::Client::GetDefaultPresenceScopes());
		args.SetCodeChallenge(verifier.Challenge());
		client->Authorize(args, [this, verifier](discordpp::ClientResult result,
		                                         std::string code,
		                                         std::string redirectUri) {
			if (!result.Successful()) {
				authorizing = false;
				status(refreshToken.empty() ? "signed-out" : "error", result.Error());
				return;
			}
			client->GetToken(applicationId, code, verifier.Verifier(), redirectUri,
			                 [this](discordpp::ClientResult result,
			                        std::string accessToken,
			                        std::string nextRefresh,
			                        discordpp::AuthorizationTokenType,
			                        int32_t, std::string) {
				                 authorizing = false;
				                 onTokens(result, accessToken, nextRefresh, false);
			                 });
		});
	}

	void refresh() {
		if (refreshToken.empty()) {
			status("signed-out");
			return;
		}
		status("connecting");
		client->RefreshToken(applicationId, refreshToken,
		                     [this](discordpp::ClientResult result,
		                            std::string accessToken,
		                            std::string nextRefresh,
		                            discordpp::AuthorizationTokenType, int32_t,
		                            std::string) {
			                     onTokens(result, accessToken, nextRefresh, true);
		                     });
	}

	void onTokens(const discordpp::ClientResult &result,
	              const std::string &accessToken, const std::string &nextRefresh,
	              bool refreshing) {
		if (!result.Successful()) {
			if (refreshing && result.Retryable()) {
				refreshAt = Clock::now() + REFRESH_RETRY;
				status("error", result.Error());
				return;
			}
			forget();
			status("signed-out", result.Error());
			return;
		}
		refreshToken = nextRefresh;
		emit({{"type", "token"}, {"refreshToken", refreshToken}});
		client->UpdateToken(discordpp::AuthorizationTokenType::Bearer, accessToken,
		                    [this](discordpp::ClientResult updated) {
			                    if (!updated.Successful()) {
				                    status("error", updated.Error());
				                    return;
			                    }
			                    if (client->GetStatus() ==
			                        discordpp::Client::Status::Disconnected) {
				                    client->Connect();
			                    }
		                    });
	}

	void forget() {
		refreshToken.clear();
		refreshAt.reset();
		emit({{"type", "token"}, {"refreshToken", nullptr}});
		emit({{"type", "user"}, {"user", nullptr}});
		emit({{"type", "friends"}, {"friends", json::array()}});
	}

	void logout() {
		client->Disconnect();
		forget();
		status("signed-out");
	}

	void sendFriends() {
		if (client->GetStatus() != discordpp::Client::Status::Ready) {
			return;
		}
		json friends = json::array();
		for (const auto &relationship : client->GetRelationships()) {
			if (relationship.DiscordRelationshipType() !=
			    discordpp::RelationshipType::Friend) {
				continue;
			}
			if (const auto user = relationship.User()) {
				friends.push_back(userJson(*user));
			}
		}
		emit({{"type", "friends"}, {"friends", friends}});
	}

	void presence(const json &input) {
		if (!input.is_object()) {
			client->ClearRichPresence();
			return;
		}
		discordpp::Activity activity;
		activity.SetType(discordpp::ActivityTypes::Playing);
		activity.SetSupportedPlatforms(discordpp::ActivityGamePlatforms::Desktop);
		if (const auto state = text(input, "state")) {
			activity.SetState(*state);
		}
		if (const auto details = text(input, "details")) {
			activity.SetDetails(*details);
		}
		if (input.contains("startedAt") && input["startedAt"].is_number_unsigned()) {
			discordpp::ActivityTimestamps timestamps;
			timestamps.SetStart(input["startedAt"].get<uint64_t>());
			activity.SetTimestamps(timestamps);
		}
		if (const auto image = text(input, "largeImage")) {
			discordpp::ActivityAssets assets;
			assets.SetLargeImage(*image);
			if (const auto caption = text(input, "largeText")) {
				assets.SetLargeText(*caption);
			}
			activity.SetAssets(assets);
		}
		if (input.contains("party") && input["party"].is_object()) {
			const auto &source = input["party"];
			const auto id = text(source, "id");
			const auto size = source.value("size", 0);
			const auto max = source.value("max", 0);
			if (id && size >= 1 && max >= size) {
				discordpp::ActivityParty party;
				party.SetId(*id);
				party.SetCurrentSize(size);
				party.SetMaxSize(max);
				party.SetPrivacy(source.value("public", false)
				                     ? discordpp::ActivityPartyPrivacy::Public
				                     : discordpp::ActivityPartyPrivacy::Private);
				activity.SetParty(party);
				if (const auto secret = text(input, "joinSecret")) {
					discordpp::ActivitySecrets secrets;
					secrets.SetJoin(*secret);
					activity.SetSecrets(secrets);
				}
			}
		}
		client->UpdateRichPresence(activity, [](discordpp::ClientResult result) {
			if (!result.Successful()) {
				log("warning", "Présence refusée : " + result.Error());
			}
		});
	}

	void invite(const json &message) {
		const auto userId =
		    message.contains("userId") ? parseId(message["userId"]) : std::nullopt;
		if (!userId) {
			return;
		}
		const auto content = text(message, "message").value_or("");
		const auto id = message["userId"].get<std::string>();
		client->SendActivityInvite(*userId, content,
		                           [id](discordpp::ClientResult result) {
			                           json reply = {{"type", "invite"},
			                                         {"userId", id},
			                                         {"ok", result.Successful()}};
			                           if (!result.Successful()) {
				                           reply["error"] = result.Error();
			                           }
			                           emit(reply);
		                           });
	}
};

void readInput() {
	std::string line;
	while (std::getline(std::cin, line)) {
		if (!line.empty() && line.back() == '\r') {
			line.pop_back();
		}
		if (!line.empty()) {
			std::lock_guard lock(inboxMutex);
			inbox.push_back(std::move(line));
		}
	}
	running = false;
}

}

int main() {
	std::ios::sync_with_stdio(false);
	Bridge bridge;
	std::thread reader(readInput);
	reader.detach();

	while (running) {
		discordpp::RunCallbacks();
		std::deque<std::string> pending;
		{
			std::lock_guard lock(inboxMutex);
			pending.swap(inbox);
		}
		for (const auto &line : pending) {
			bridge.handle(line);
		}
		bridge.tick();
		std::this_thread::sleep_for(TICK);
	}
	return 0;
}
