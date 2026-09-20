import "server-only";

import { prisma } from "./db";
import { NotFoundError } from "./templates";
import type { ScoutedAdDTO } from "./types";

export interface RawScoutedAd {
  id: string;
  advertiserName: string;
  headline: string;
  creativeSnapshotUrl: string;
  category: string;
  platforms: string[];
  deliveryStartDate: Date;
  deliveryStopDate: Date | null;
  approvedForPublic?: boolean;
}

/** Provider-agnostic interface for Meta Ad Library scraper */
export interface MetaAdProvider {
  fetchRecentAds(keywords: string[]): Promise<RawScoutedAd[]>;
}

/** Mock/Stub Meta Ad Library provider for development without Meta developer token */
export class StubMetaAdProvider implements MetaAdProvider {
  async fetchRecentAds(keywords: string[]): Promise<RawScoutedAd[]> {
    const categories = ["E-Commerce & DTC", "Mobile Apps & SaaS", "Beauty & Personal Care", "Fitness & Wellness", "Education & Courses"];
    const advertisers = [
      { name: "GlowLab Skincare", cat: "Beauty & Personal Care", shot: "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600&q=80" },
      { name: "TaskFlow AI", cat: "Mobile Apps & SaaS", shot: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&q=80" },
      { name: "Aura Home Sound", cat: "E-Commerce & DTC", shot: "https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=600&q=80" },
      { name: "Stride Ortho Footwear", cat: "Fitness & Wellness", shot: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&q=80" },
      { name: "PromptCraft Masterclass", cat: "Education & Courses", shot: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&q=80" },
      { name: "HydraBoost Electrolytes", cat: "Fitness & Wellness", shot: "https://images.unsplash.com/photo-1556228722-d0b7194f4c9c?w=600&q=80" },
      { name: "ZenDesk Screen Studio", cat: "Mobile Apps & SaaS", shot: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&q=80" },
      { name: "NutriMeal Smart Bowl", cat: "E-Commerce & DTC", shot: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&q=80" },
    ];

    const now = new Date();
    return advertisers.map((adv, idx) => {
      const daysRunning = 8 + (idx * 6);
      const startDate = new Date(now.getTime() - (daysRunning * 24 * 3600 * 1000));
      return {
        id: `meta-ad-${adv.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
        advertiserName: adv.name,
        headline: `Transform your routine with ${adv.name}. Tested by 45,000+ creators and verified on Meta.`,
        creativeSnapshotUrl: adv.shot,
        category: adv.cat,
        platforms: ["facebook", "instagram", "messenger"],
        deliveryStartDate: startDate,
        deliveryStopDate: null, // stub ads are all still running
        approvedForPublic: idx < 5, // first 5 approved by default
      };
    });
  }
}

/** Real Meta Graph API adapter (reads META_ACCESS_TOKEN from env) */
export class LiveMetaAdProvider implements MetaAdProvider {
  constructor(private token: string) {}

  async fetchRecentAds(keywords: string[]): Promise<RawScoutedAd[]> {
    if (!this.token) throw new Error("META_ACCESS_TOKEN is required for live Meta Ad Library calls");
    // TODO: call https://graph.facebook.com/v21.0/ads_archive (search_terms, ad_reached_countries, fields...).
    // Fail loudly rather than "succeed" with zero ads while the real adapter doesn't exist.
    throw new Error("Live Meta Ad Library sync is not implemented yet. Unset META_ACCESS_TOKEN to use the stub provider.");
  }
}

export function getMetaProvider(): MetaAdProvider {
  const token = process.env.META_ACCESS_TOKEN;
  return token ? new LiveMetaAdProvider(token) : new StubMetaAdProvider();
}

/** Upsert scraped ads into database */
export async function syncScoutedAds(): Promise<{ totalSynced: number }> {
  const provider = getMetaProvider();
  const ads = await provider.fetchRecentAds(["ai video ads", "ugc unboxing", "saas demo"]);

  for (const ad of ads) {
    await prisma.scoutedAd.upsert({
      where: { id: ad.id },
      create: {
        id: ad.id,
        advertiserName: ad.advertiserName,
        headline: ad.headline,
        creativeSnapshotUrl: ad.creativeSnapshotUrl,
        category: ad.category,
        platforms: ad.platforms,
        deliveryStartDate: ad.deliveryStartDate,
        deliveryStopDate: ad.deliveryStopDate,
        approvedForPublic: ad.approvedForPublic ?? false,
        firstSeenAt: ad.deliveryStartDate,
        lastSeenAt: new Date(),
      },
      update: {
        lastSeenAt: new Date(),
        deliveryStopDate: ad.deliveryStopDate,
      },
    });
  }

  return { totalSynced: ads.length };
}

/** List scouted ads for admin with vote counts */
export async function listScoutedAdsAdmin(category?: string, sortBy: "votes" | "recent" = "votes") {
  const where = category && category !== "all" ? { category } : {};
  const rows = await prisma.scoutedAd.findMany({
    where,
    include: {
      _count: { select: { votes: true } },
    },
    orderBy: sortBy === "votes" ? [{ votes: { _count: "desc" } }, { createdAt: "desc" }] : [{ createdAt: "desc" }],
  });

  return rows.map((r): ScoutedAdDTO => ({
    id: r.id,
    advertiserName: r.advertiserName,
    headline: r.headline,
    creativeSnapshotUrl: r.creativeSnapshotUrl,
    category: r.category,
    platforms: Array.isArray(r.platforms) ? (r.platforms as string[]) : ["facebook", "instagram"],
    deliveryStartDate: r.deliveryStartDate.toISOString(),
    deliveryStopDate: r.deliveryStopDate ? r.deliveryStopDate.toISOString() : null,
    stillRunning: r.deliveryStopDate === null,
    approvedForPublic: r.approvedForPublic,
    voteCount: r._count.votes,
    firstSeenAt: r.firstSeenAt.toISOString(),
    lastSeenAt: r.lastSeenAt.toISOString(),
  }));
}

/** List approved scouted ads for public with user vote state */
export async function listScoutedAdsPublic(userId?: string, category?: string) {
  const where = {
    approvedForPublic: true,
    ...(category && category !== "all" ? { category } : {}),
  };

  const rows = await prisma.scoutedAd.findMany({
    where,
    include: {
      _count: { select: { votes: true } },
      votes: userId ? { where: { userId }, select: { id: true } } : false,
    },
    orderBy: [{ votes: { _count: "desc" } }, { createdAt: "desc" }],
  });

  return rows.map((r): ScoutedAdDTO => ({
    id: r.id,
    advertiserName: r.advertiserName,
    headline: r.headline,
    creativeSnapshotUrl: r.creativeSnapshotUrl,
    category: r.category,
    platforms: Array.isArray(r.platforms) ? (r.platforms as string[]) : ["facebook", "instagram"],
    deliveryStartDate: r.deliveryStartDate.toISOString(),
    deliveryStopDate: r.deliveryStopDate ? r.deliveryStopDate.toISOString() : null,
    stillRunning: r.deliveryStopDate === null,
    approvedForPublic: true,
    voteCount: r._count.votes,
    hasUserVoted: userId ? Array.isArray(r.votes) && r.votes.length > 0 : false,
    firstSeenAt: r.firstSeenAt.toISOString(),
    lastSeenAt: r.lastSeenAt.toISOString(),
  }));
}

/** Cast or toggle vote. Only ads the admin has approved for the public can be voted on. */
export async function toggleVote(scoutedAdId: string, userId: string): Promise<{ voted: boolean; count: number }> {
  const ad = await prisma.scoutedAd.findFirst({ where: { id: scoutedAdId, approvedForPublic: true }, select: { id: true } });
  if (!ad) throw new NotFoundError("Ad not found");

  // Delete-first is race-safe: a double click can't create two votes or trip the unique index.
  const removed = await prisma.vote.deleteMany({ where: { scoutedAdId, userId } });
  let voted = false;
  if (removed.count === 0) {
    try {
      await prisma.vote.create({ data: { scoutedAdId, userId } });
    } catch (e) {
      if ((e as { code?: string }).code !== "P2002") throw e; // a concurrent request already voted
    }
    voted = true;
  }
  const count = await prisma.vote.count({ where: { scoutedAdId } });
  return { voted, count };
}

/** Toggle admin approved for public */
export async function setScoutedAdApproval(id: string, approvedForPublic: boolean) {
  return prisma.scoutedAd.update({
    where: { id },
    data: { approvedForPublic },
  });
}
