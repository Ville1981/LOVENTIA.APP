// PATH: client/src/pages/PremiumHub.jsx

// --- REPLACE START: Premium Hub – use premium i18n namespace + localized benefit items ---
import React, { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { useAuth } from "../contexts/AuthContext";
import Button from "../components/ui/Button";
import ControlBar from "../components/ui/ControlBar";
import AdGate from "../components/AdGate";
import AdBanner from "../components/AdBanner";

export default function PremiumHub() {
  // Use dedicated namespaces:
  // - "premium" for Premium Hub texts
  // - "common" for shared UI labels (e.g. Back button)
  const { t: tPremium } = useTranslation("premium");
  const { t: tCommon } = useTranslation("common");

  const { user } = useAuth() || {};
  const navigate = useNavigate();

  useEffect(() => {
    // Document title comes from premium namespace
    document.title = tPremium("hub.title", { defaultValue: "Premium Hub" });
  }, [tPremium]);

  const entitlements = user?.entitlements || {};
  const tier =
    entitlements.tier || (user?.isPremium || user?.premium ? "premium" : "free");
  const isPremium =
    tier === "premium" || user?.isPremium === true || user?.premium === true;

  const features = entitlements.features || {};
  const quotas = entitlements.quotas || {};
  const superLikesPerWeek =
    quotas?.superLikes?.perWeek ??
    quotas?.superLikesPerWeek ??
    features?.superLikesPerWeek ??
    0;

  const benefitItems = useMemo(
    () => [
      {
        key: "noAds",
        active: !!(features.noAds || isPremium),
        title: tPremium("hub.benefits.noAds.title", {
          defaultValue: "Ad-free experience",
        }),
        description: tPremium("hub.benefits.noAds.description", {
          defaultValue: "No banner ads across Loventia.",
        }),
      },
      {
        key: "unlimitedLikes",
        active: !!(features.unlimitedLikes || isPremium),
        title: tPremium("hub.benefits.unlimitedLikes.title", {
          defaultValue: "Unlimited Likes",
        }),
        description: tPremium("hub.benefits.unlimitedLikes.description", {
          defaultValue: "Like as many profiles as you want every day.",
        }),
      },
      {
        key: "unlimitedRewinds",
        active: !!(features.unlimitedRewinds || isPremium),
        title: tPremium("hub.benefits.unlimitedRewinds.title", {
          defaultValue: "Unlimited Rewinds",
        }),
        description: tPremium("hub.benefits.unlimitedRewinds.description", {
          defaultValue: "Go back to the previous profile if you swiped too fast.",
        }),
      },
      {
        key: "whoLikedMe",
        active: !!(features.whoLikedMe || isPremium),
        title: tPremium("hub.benefits.whoLikedMe.title", {
          defaultValue: "See who liked you",
        }),
        description: tPremium("hub.benefits.whoLikedMe.description", {
          defaultValue: "Open the Likes overview to see who already liked you.",
        }),
      },
      {
        key: "superLikesPerWeek",
        active: superLikesPerWeek > 0 || isPremium,
        title: tPremium("hub.benefits.superLikesPerWeek.title", {
          defaultValue: "Weekly Super Likes",
        }),
        description:
          superLikesPerWeek > 0
            ? tPremium("hub.benefits.superLikesPerWeek.descriptionWithCount", {
                defaultValue: "You currently get {{count}} Super Likes per week.",
                count: superLikesPerWeek,
              })
            : tPremium("hub.benefits.superLikesPerWeek.description", {
                defaultValue: "Highlight yourself with Super Likes each week.",
              }),
      },
      {
        key: "intros",
        active: !!(features.intros || isPremium),
        title: tPremium("hub.benefits.intros.title", {
          defaultValue: "Intro messages",
        }),
        description: tPremium("hub.benefits.intros.description", {
          defaultValue:
            "Send a first message even before you match (where allowed).",
        }),
      },
      {
        key: "dealbreakers",
        active: !!(features.dealbreakers || isPremium),
        title: tPremium("hub.benefits.dealbreakers.title", {
          defaultValue: "Dealbreaker filters",
        }),
        description: tPremium("hub.benefits.dealbreakers.description", {
          defaultValue:
            "Use hard filters in Discover to only see matches that fit your must-haves.",
        }),
      },
      {
        key: "badge",
        active: !!(features.premiumBadge || isPremium),
        title: tPremium("hub.benefits.badge.title", {
          defaultValue: "Premium badge",
        }),
        description: tPremium("hub.benefits.badge.description", {
          defaultValue:
            "Show a small Premium badge on your profile and messages.",
        }),
      },
    ],
    [features, isPremium, superLikesPerWeek, tPremium]
  );

  const planPremiumLabel = tPremium("hub.planPremium", {
    defaultValue: "Premium",
  });
  const planFreeLabel = tPremium("hub.planFree", {
    defaultValue: "Free",
  });
  const planLabel = isPremium ? planPremiumLabel : planFreeLabel;

  return (
    <div className="max-w-4xl mx-auto px-3 py-6 space-y-8">
      <ControlBar
        title={tPremium("hub.title", {
          defaultValue: "Premium Hub",
        })}
      >
        <Button onClick={() => navigate(-1)} variant="gray">
          {tCommon("buttons.back", { defaultValue: "Back" })}
        </Button>
      </ControlBar>

      {/* Plan status */}
      <section className="border rounded-md p-4 space-y-3 bg-white">
        <h2 className="text-lg font-semibold">
          {tPremium("hub.currentPlanTitle", {
            defaultValue: "Your current plan",
          })}
        </h2>
        <p className="text-sm text-gray-700">
          {tPremium("hub.currentPlanDescription", {
            defaultValue:
              "This page shows your current Premium status and the benefits that are active on your account.",
          })}
        </p>

        <div className="flex flex-wrap items-center gap-3 mt-2">
          <span
            className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold ${
              isPremium
                ? "bg-yellow-100 text-yellow-800"
                : "bg-gray-100 text-gray-800"
            }`}
          >
            <span aria-hidden="true">{isPremium ? "👑" : "✨"}</span>
            <span>
              {tPremium("hub.planLabel", {
                defaultValue: "Current plan:",
              })}{" "}
              <strong>{planLabel}</strong>
            </span>
          </span>

          {isPremium ? (
            <span className="text-xs text-green-700">
              {tPremium("hub.activeHint", {
                defaultValue:
                  "Premium is active. Most benefits below should already be unlocked.",
              })}
            </span>
          ) : (
            <span className="text-xs text-amber-700">
              {tPremium("hub.freeHint", {
                defaultValue:
                  "You are currently on the Free plan. Upgrade to unlock all Premium benefits.",
              })}
            </span>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <Button
            variant="yellow"
            onClick={() => navigate("/settings/subscriptions")}
          >
            {tPremium("hub.manageSubscription", {
              defaultValue: "Manage subscription",
            })}
          </Button>

          {!isPremium && (
            <Button
              variant="primary"
              onClick={() => navigate("/upgrade")}
            >
              {tPremium("hub.upgradeNow", {
                defaultValue: "Upgrade to Premium",
              })}
            </Button>
          )}
        </div>

        <p className="mt-3 text-xs text-gray-500">
          {tPremium("hub.syncHint", {
            defaultValue:
              "If something looks out of date, open Subscription Settings and press Sync. It will pull the latest entitlements from billing.",
          })}
        </p>
      </section>

      {/* Benefits overview */}
      <section className="border rounded-md p-4 space-y-4 bg-white">
        <h2 className="text-lg font-semibold">
          {tPremium("hub.benefitsTitle", {
            defaultValue: "Premium benefits",
          })}
        </h2>
        <p className="text-sm text-gray-700">
          {tPremium("hub.benefitsDescription", {
            defaultValue:
              "Here is a quick overview of what Premium offers. Active benefits are highlighted, locked ones are shown in gray.",
          })}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
          {benefitItems.map((b) => (
            <div
              key={b.key}
              className={`border rounded-md p-3 flex items-start gap-3 ${
                b.active
                  ? "bg-emerald-50 border-emerald-200"
                  : "bg-gray-50 border-dashed border-gray-200"
              }`}
            >
              <div
                className={`mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full text-sm ${
                  b.active
                    ? "bg-emerald-500 text-white"
                    : "bg-gray-300 text-gray-700"
                }`}
                aria-hidden="true"
              >
                {b.active ? "✓" : "🔒"}
              </div>
              <div>
                <h3 className="text-sm font-semibold">{b.title}</h3>
                <p className="text-xs text-gray-700 mt-1">{b.description}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 text-xs text-gray-500">
          {tPremium("hub.note", {
            defaultValue:
              "Some benefits may depend on local laws or safety rules. We may roll out new Premium features over time.",
          })}
        </div>
      </section>

      {/* Inline ad – visible only for non-premium users via AdGate */}
      <AdGate type="inline" debug={false}>
        <div className="max-w-3xl mx-auto mt-4">
          <AdBanner
            imageSrc="/ads/ad-right1.png"
            headline="Sponsored"
            body="Upgrade to Premium to remove all ads."
          />
        </div>
      </AdGate>
    </div>
  );
}
// --- REPLACE END ---

