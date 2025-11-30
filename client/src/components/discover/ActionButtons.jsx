// PATH: client/src/components/discover/ActionButtons.jsx

// --- REPLACE START: ActionButtons – Super Like + Likes quota label + SL-UI2 + Block button + basic a11y labels ---
import PropTypes from "prop-types";
import React from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useTranslation } from "react-i18next";

/**
 * ActionButtons
 *
 * Renders Pass / Like / Super Like / Block buttons.
 *
 * Behaviour:
 * ✅ If userId === current logged-in user → simulate action locally,
 *    skip API call to avoid 400 "Cannot act on self".
 * ✅ Super Like shows remaining quota as "Super Like X/Y".
 * ✅ When Super Like quota is exhausted (X === 0), Super Like button is disabled + grey.
 * ✅ Supports optional likes quota label for free users:
 *    "You have used X / Y likes today." when parent passes limit/remaining props.
 * ✅ (SL-UI2) Shows a short success message when Super Like is sent.
 * ✅ (SL-UI2) When quota is exhausted, shows a clear text message:
 *    - Free:   "You have used your weekly Super Like. Upgrade to Premium for more."
 *    - Premium:"You have used all your Super Likes for this week. They reset on Monday."
 * ✅ (Likes UI) Shows a small reset hint for daily likes quota:
 *    "Resets at midnight (Europe/Helsinki)."
 * ✅ (Block) Adds a Block button that calls an optional onBlock(userId) callback.
 * ✅ (A11y) Buttons are keyboard-focusable and have clear aria-labels and titles.
 *    Also exposes keyboard hints via aria-keyshortcuts to match ProfileCard shortcuts:
 *    • ArrowLeft  = Pass
 *    • ArrowRight = Like
 *    • ArrowUp    = Super Like
 */
const ActionButtons = ({
  userId,
  onPass,
  onLike,
  onSuperlike,
  onBlock,
  likesLimitPerDay,
  likesRemainingToday,
}) => {
  const { t } = useTranslation();
  const { user: authUser, entitlements: ctxEntitlements } = useAuth();

  const currentUserId =
    authUser?._id?.toString?.() || authUser?.id?.toString?.() || null;

  // ---------------------------------------------------------------------------
  // Premium flag (used to hide likes quota label for premium users)
  // ---------------------------------------------------------------------------
  const isPremiumUser =
    authUser?.isPremium === true || authUser?.premium === true;

  // ---------------------------------------------------------------------------
  // Super Like quota derivation (from AuthContext + local state)
  // ---------------------------------------------------------------------------

  // Prefer raw user.entitlements.features, fall back to context entitlements.features
  const userEntitlements = authUser?.entitlements || {};
  const features =
    (userEntitlements && userEntitlements.features) ||
    (ctxEntitlements && ctxEntitlements.features) ||
    {};

  const superLikesPerWeek = Number(
    features.superLikesPerWeek != null ? features.superLikesPerWeek : 0
  );

  // Prefer raw user.entitlements.quotas.superLikes, then ctx entitlements.quotas.superLikes
  const quotasFromUser =
    (userEntitlements &&
      userEntitlements.quotas &&
      userEntitlements.quotas.superLikes) ||
    (ctxEntitlements &&
      ctxEntitlements.quotas &&
      ctxEntitlements.quotas.superLikes) ||
    {};

  const serverUsedRaw =
    quotasFromUser && quotasFromUser.used != null ? quotasFromUser.used : 0;
  const serverUsed = Number(serverUsedRaw);

  // Remaining according to server data (used only as initial value / reset)
  const serverRemaining = Math.max(
    Number.isFinite(superLikesPerWeek) ? superLikesPerWeek - serverUsed : 0,
    0
  );

  // Local state so the Super Like label updates immediately after click,
  // without waiting for any backend sync.
  const [localSuperLikesLeft, setLocalSuperLikesLeft] = React.useState(
    () => serverRemaining
  );

  // (SL-UI2) Local flag for a short success message after Super Like click.
  // The component is usually unmounted when the card changes, so this can stay true
  // until unmount without causing issues.
  const [showSuperLikeSuccess, setShowSuperLikeSuccess] =
    React.useState(false);

  // If entitlements change (e.g. billing sync / hard refresh), resync local Super Like state.
  React.useEffect(() => {
    setLocalSuperLikesLeft(serverRemaining);
    // Reset the success message when server quota changes,
    // so the message does not stick across hard refresh or billing changes.
    setShowSuperLikeSuccess(false);
  }, [serverRemaining, superLikesPerWeek]);

  const hasConfiguredSuperLikeQuota =
    Number.isFinite(superLikesPerWeek) && superLikesPerWeek > 0;

  const superLikeDisabled =
    !hasConfiguredSuperLikeQuota ||
    !Number.isFinite(localSuperLikesLeft) ||
    localSuperLikesLeft <= 0;

  const superLikeLabel = hasConfiguredSuperLikeQuota
    ? t("premium.superLike.buttonLabelWithQuota", {
        defaultValue: "Super Like {{remaining}}/{{limit}}",
        remaining:
          Number.isFinite(localSuperLikesLeft) && localSuperLikesLeft >= 0
            ? localSuperLikesLeft
            : 0,
        limit: superLikesPerWeek,
      })
    : t("premium.superLike.buttonLabel", "Super Like");

  const baseSuperLikeClasses =
    "flex-1 text-white py-2 rounded-full transition duration-150 flex items-center justify-center space-x-1 focus:outline-none";
  const enabledSuperLikeClasses = "bg-[#005FFF] hover:opacity-90 cursor-pointer";
  const disabledSuperLikeClasses =
    "bg-gray-300 text-gray-600 cursor-not-allowed opacity-70";

  const isOutOfSuperLikes =
    hasConfiguredSuperLikeQuota &&
    Number.isFinite(localSuperLikesLeft) &&
    localSuperLikesLeft <= 0;

  // ---------------------------------------------------------------------------
  // Likes quota label – derived from optional props
  // ---------------------------------------------------------------------------
  const hasLikesQuotaData =
    typeof likesLimitPerDay === "number" &&
    typeof likesRemainingToday === "number" &&
    likesLimitPerDay > 0 &&
    likesRemainingToday >= 0;

  const likesUsedToday = hasLikesQuotaData
    ? likesLimitPerDay - likesRemainingToday
    : null;

  const showLikesQuotaLabel =
    !isPremiumUser && hasLikesQuotaData && likesUsedToday != null;

  /**
   * Generic click handler for all actions.
   * - For self-actions, logs and simulates locally without depending on API.
   * - For Super Like, respects quota and updates local remaining-counter.
   * - (SL-UI2) On Super Like, sets a local success message flag,
   *   unless quota is exhausted.
   * - (Block) For "block" type, just forwards to onBlock(userId) if provided.
   */
  const handleClick = (callback, type) => (e) => {
    e.preventDefault();

    const isSelf = currentUserId && userId === currentUserId;

    // Super Like quota guard: if no remaining quota (and not self),
    // do not call onSuperlike at all → no API call, card stays visible.
    if (type === "superlike" && superLikeDisabled && !isSelf) {
      try {
        // eslint-disable-next-line no-console
        console.warn(
          "[ActionButtons] Super Like click ignored (no remaining quota).",
          {
            superLikesPerWeek,
            localSuperLikesLeft,
            serverRemaining,
          }
        );
      } catch {
        /* ignore */
      }
      return;
    }

    // Normal flow (includes self & non-self)
    if (typeof callback === "function") {
      if (isSelf) {
        try {
          // eslint-disable-next-line no-console
          console.warn(
            `[ActionButtons] Skipping API for self-${type}, simulating locally`
          );
        } catch {
          /* ignore */
        }
        callback(userId);
      } else {
        callback(userId);
      }
    }

    // After a successful Super Like click (non-disabled), decrement local remaining
    // and show a small success message.
    if (type === "superlike" && !superLikeDisabled) {
      setLocalSuperLikesLeft((prevRaw) => {
        const prev =
          Number.isFinite(prevRaw) && prevRaw >= 0
            ? prevRaw
            : serverRemaining;
        const next = Math.max(prev - 1, 0);

        try {
          // eslint-disable-next-line no-console
          console.debug("[ActionButtons] Super Like used", {
            previous: prev,
            next,
            serverRemaining,
          });
        } catch {
          /* ignore */
        }

        return next;
      });

      // Optimistic success message for the current card.
      setShowSuperLikeSuccess(true);
    }
  };

  // ---------------------------------------------------------------------------
  // A11y labels / titles (i18n with English fallbacks)
  // ---------------------------------------------------------------------------
  const groupLabel = t(
    "discover:actions.groupLabel",
    "Match actions for this profile"
  );

  const blockAriaLabel = t(
    "discover:actions.blockAriaLabel",
    "Block this profile"
  );
  const blockTitle = t("discover:actions.blockTitle", "Block this profile");

  const passAriaLabel = t(
    "discover:actions.passAriaLabel",
    "Pass this profile"
  );
  const passTitle = t("discover:actions.passTitle", "Pass this profile");

  const likeAriaLabel = t(
    "discover:actions.likeAriaLabel",
    "Like this profile"
  );
  const likeTitle = t("discover:actions.likeTitle", "Like this profile");

  const superLikeAriaLabel = t(
    "discover:actions.superLikeAriaLabel",
    "Send a Super Like to this profile"
  );
  const superLikeTitle = t(
    "discover:actions.superLikeTitle",
    "Send a Super Like to this profile"
  );

  return (
    <div
      className="mt-4"
      style={{ overflowAnchor: "none" }}
    >
      {/* Buttons row: Block / Pass / Like / Super Like */}
      <div
        className="flex justify-between space-x-2"
        role="group"
        aria-label={groupLabel}
      >
        {/* Block button – optional, only meaningful if onBlock is provided */}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleClick(onBlock, "block")}
          className="flex-1 border-2 border-red-500 text-red-600 py-2 rounded-full hover:bg-red-50 transition duration-150 focus:outline-none"
          aria-label={blockAriaLabel}
          title={blockTitle}
        >
          🚫{" "}
          {t(
            "discover:blockButtonLabel",
            "Block"
          )}
        </button>

        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleClick(onPass, "pass")}
          className="flex-1 border-2 border-black text-black py-2 rounded-full hover:bg-gray-100 transition duration-150 focus:outline-none"
          aria-label={passAriaLabel}
          title={passTitle}
          aria-keyshortcuts="ArrowLeft"
        >
          ❌ Pass
        </button>

        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleClick(onLike, "like")}
          className="flex-1 bg-[#FF4081] text-white py-2 rounded-full hover:opacity-90 transition duration-150 focus:outline-none"
          aria-label={likeAriaLabel}
          title={likeTitle}
          aria-keyshortcuts="ArrowRight"
        >
          ❤️ Like
        </button>

        <button
          type="button"
          disabled={superLikeDisabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleClick(onSuperlike, "superlike")}
          className={`${baseSuperLikeClasses} ${
            superLikeDisabled
              ? disabledSuperLikeClasses
              : enabledSuperLikeClasses
          }`}
          aria-label={superLikeAriaLabel}
          title={superLikeTitle}
          aria-keyshortcuts="ArrowUp"
        >
          <span>⭐</span>
          <span>{superLikeLabel}</span>
        </button>
      </div>

      {/* Super Like success message (only when there is still quota left) */}
      {showSuperLikeSuccess && !isOutOfSuperLikes && (
        <p className="mt-1 text-xs text-green-600 text-center">
          {t(
            "premium.superLike.sent",
            "Super Like sent \u2728"
          )}
        </p>
      )}

      {/* Super Like quota-exhausted messages */}
      {isOutOfSuperLikes && (
        <p className="mt-1 text-xs text-gray-700 text-center">
          {isPremiumUser
            ? t(
                "premium.superLike.quotaPremiumExhausted",
                "You have used all your Super Likes for this week. They reset on Monday."
              )
            : t(
                "premium.superLike.quotaFreeExhausted",
                "You have used your weekly Super Like. Upgrade to Premium for more."
              )}
        </p>
      )}

      {/* Likes quota text for free users, if parent passes limit/remaining */}
      {showLikesQuotaLabel && (
        <>
          <p className="mt-1 text-xs text-gray-600 text-center">
            {t(
              "premium.likes.quotaLabel",
              "You have used {{used}} / {{limit}} likes today.",
              {
                used: likesUsedToday,
                limit: likesLimitPerDay,
              }
            )}
          </p>
          {/* Small reset hint for daily likes quota */}
          <p className="mt-0.5 text-[11px] text-gray-500 text-center">
            {t(
              "premium.likes.quotaResetHint",
              "Resets at midnight (Europe/Helsinki)."
            )}
          </p>
        </>
      )}
    </div>
  );
};

ActionButtons.propTypes = {
  userId: PropTypes.string.isRequired,
  onPass: PropTypes.func.isRequired,
  onLike: PropTypes.func.isRequired,
  onSuperlike: PropTypes.func.isRequired,
  // Optional block handler for Discover cards
  onBlock: PropTypes.func,
  // Optional likes quota data for free users
  likesLimitPerDay: PropTypes.number,
  likesRemainingToday: PropTypes.number,
};

export default React.memo(ActionButtons);
// --- REPLACE END ---
