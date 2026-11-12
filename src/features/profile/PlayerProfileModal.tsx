import type { AccountStats, PublicProfile } from "@shared/protocol/account";
import { LANTERN_TINT_COLORS } from "@shared/rewards";
import { useEffect, useState } from "react";
import { HatPreview } from "../../components/HatPreview";
import { Icon } from "../../components/Icon";
import { Modal } from "../../components/Modal";
import { TaglineBadge } from "../../components/TaglineBadge";
import { useStore } from "../../hooks/useStore";
import { useT } from "../../i18n";
import { hexColor } from "../../utils/format";
import { accountApi } from "../account/accountApi";
import { LevelProgress } from "./LevelProgress";
import styles from "./PlayerProfileModal.module.scss";
import { closeProfile, profileViewStore } from "./profileViewStore";

type Loaded =
	| { status: "loading" }
	| { status: "missing" }
	| { status: "ready"; profile: PublicProfile };

function ProfileBody({ profile }: { profile: PublicProfile }) {
	const t = useT();
	const labels = t.progression.profile;
	const { stats } = profile;
	return (
		<div className={styles.body}>
			<div className={styles.identity}>
				<span className={styles.hat}>
					<HatPreview color={profile.color} pattern={profile.pattern} />
				</span>
				<div className={styles.names}>
					<strong className={styles.name}>{profile.displayName}</strong>
					<TaglineBadge tagline={profile.tagline} className={styles.tagline} />
					{profile.createdAt ? (
						<span className={styles.since}>
							{labels.memberSince(new Date(profile.createdAt))}
						</span>
					) : null}
				</div>
				<span
					className={styles.lantern}
					style={{ color: hexColor(LANTERN_TINT_COLORS[profile.lantern]) }}
					title={t.appearance.lanterns[profile.lantern]}
				>
					<Icon name="lantern" />
				</span>
			</div>
			{stats ? (
				<PublicDetails profile={profile} stats={stats} />
			) : (
				<div className={styles.locked}>
					<span className={styles.lockedLevel}>
						{t.progression.level(profile.level)}
					</span>
					<span className={styles.lockedIcon}>
						<Icon name="lock" />
					</span>
					<strong>{labels.private}</strong>
					<p>{labels.privateNote}</p>
				</div>
			)}
		</div>
	);
}

function PublicDetails({
	profile,
	stats,
}: {
	profile: PublicProfile;
	stats: AccountStats;
}) {
	const t = useT();
	const labels = t.progression.profile;
	return (
		<>
			{profile.private ? (
				<p className={styles.sharedPrivate}>
					<Icon name="lock" />
					{labels.privateShared}
				</p>
			) : null}
			<LevelProgress xp={stats.xp} showNextReward={false} />
			<dl className={styles.stats}>
				<div>
					<dt>{labels.games}</dt>
					<dd>{t.common.number(stats.gamesPlayed)}</dd>
				</div>
				<div>
					<dt>{labels.wins}</dt>
					<dd>{t.common.number(stats.wins)}</dd>
				</div>
				<div>
					<dt>{labels.best}</dt>
					<dd>{t.common.number(stats.bestScore)}</dd>
				</div>
				<div>
					<dt>{labels.captures}</dt>
					<dd>{t.common.number(stats.captures)}</dd>
				</div>
			</dl>
			<section>
				<h3 className={styles.section}>{labels.recent}</h3>
				{profile.recent.length === 0 ? (
					<p className={styles.note}>{labels.noRecent}</p>
				) : (
					<ul className={styles.recent}>
						{profile.recent.map((match) => (
							<li key={match.playedAt} className={match.won ? styles.won : ""}>
								<span className={styles.date}>
									{labels.date(new Date(match.playedAt))}
								</span>
								<span className={styles.rank}>
									{labels.rank(match.rank, match.playerCount)}
								</span>
								<span className={styles.tags}>
									{match.won ? labels.won : null}
									{match.daily ? ` ${labels.daily}` : null}
								</span>
								<span className={styles.score}>
									{t.common.points(match.score)}
								</span>
							</li>
						))}
					</ul>
				)}
			</section>
		</>
	);
}

export function PlayerProfileModal() {
	const t = useT();
	const profileId = useStore(profileViewStore, (state) => state.profileId);
	const [loaded, setLoaded] = useState<Loaded>({ status: "loading" });
	useEffect(() => {
		if (!profileId) {
			return;
		}
		let cancelled = false;
		setLoaded({ status: "loading" });
		void accountApi.publicProfile(profileId).then((result) => {
			if (!cancelled) {
				setLoaded(
					result.ok
						? { status: "ready", profile: result.value.profile }
						: { status: "missing" },
				);
			}
		});
		return () => {
			cancelled = true;
		};
	}, [profileId]);
	if (!profileId) {
		return null;
	}
	return (
		<Modal title={t.progression.profile.title} onClose={closeProfile}>
			{loaded.status === "loading" ? (
				<p className={styles.note}>{t.progression.profile.loading}</p>
			) : null}
			{loaded.status === "missing" ? (
				<p className={styles.note}>{t.progression.profile.notFound}</p>
			) : null}
			{loaded.status === "ready" ? (
				<ProfileBody profile={loaded.profile} />
			) : null}
		</Modal>
	);
}
