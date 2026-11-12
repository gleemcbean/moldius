cmake_minimum_required(VERSION 3.20)
project(moldius_discord LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_MSVC_RUNTIME_LIBRARY "MultiThreaded$<$<CONFIG:Debug>:Debug>")

set(DISCORD_SOCIAL_SDK_DIR "${CMAKE_CURRENT_SOURCE_DIR}/sdk/discord_social_sdk"
	CACHE PATH "Dossier du Discord Social SDK décompressé (include/, lib/, bin/)")

if(NOT EXISTS "${DISCORD_SOCIAL_SDK_DIR}/include/discordpp.h")
	message(FATAL_ERROR
		"Discord Social SDK introuvable dans ${DISCORD_SOCIAL_SDK_DIR}.\n"
		"Téléchargez le SDK C++ depuis le portail développeur Discord et "
		"décompressez-le dans desktop/discord-bridge/sdk/ (voir README).")
endif()

include(FetchContent)
FetchContent_Declare(json
	URL https://github.com/nlohmann/json/releases/download/v3.11.3/json.tar.xz
	DOWNLOAD_EXTRACT_TIMESTAMP TRUE)
FetchContent_MakeAvailable(json)

add_executable(moldius-discord src/main.cpp)
target_include_directories(moldius-discord PRIVATE "${DISCORD_SOCIAL_SDK_DIR}/include")
target_link_libraries(moldius-discord PRIVATE nlohmann_json::nlohmann_json)

if(WIN32)
	target_link_libraries(moldius-discord PRIVATE
		"${DISCORD_SOCIAL_SDK_DIR}/lib/release/discord_partner_sdk.lib")
	set(DISCORD_RUNTIME "${DISCORD_SOCIAL_SDK_DIR}/bin/release/discord_partner_sdk.dll")
elseif(APPLE)
	set(DISCORD_RUNTIME "${DISCORD_SOCIAL_SDK_DIR}/lib/release/libdiscord_partner_sdk.dylib")
	target_link_libraries(moldius-discord PRIVATE "${DISCORD_RUNTIME}")
	set_target_properties(moldius-discord PROPERTIES INSTALL_RPATH "@executable_path")
else()
	set(DISCORD_RUNTIME "${DISCORD_SOCIAL_SDK_DIR}/lib/release/libdiscord_partner_sdk.so")
	target_link_libraries(moldius-discord PRIVATE "${DISCORD_RUNTIME}")
	set_target_properties(moldius-discord PROPERTIES INSTALL_RPATH "$ORIGIN")
endif()

add_custom_command(TARGET moldius-discord POST_BUILD
	COMMAND ${CMAKE_COMMAND} -E copy_if_different "${DISCORD_RUNTIME}"
		"$<TARGET_FILE_DIR:moldius-discord>")

install(TARGETS moldius-discord RUNTIME DESTINATION .)
install(FILES "${DISCORD_RUNTIME}" DESTINATION .)
