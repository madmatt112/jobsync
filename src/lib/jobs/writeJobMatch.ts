import prisma from "@/lib/db";

export async function writeJobMatch(
  userId: string,
  jobId: string,
  matchScore: number,
  matchData: string,
): Promise<void> {
  await prisma.job.update({
    where: { id: jobId, userId },
    data: { matchScore, matchData },
  });
}
