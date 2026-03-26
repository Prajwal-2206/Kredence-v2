import { NextResponse } from 'next/server';
import { getLiveGovernancePower } from '@/lib/governanceReads';
import { getUserVotes, getProposalsAuthoredCount } from '@/lib/snapshotClient';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');
  
  if (!address) return NextResponse.json({ error: 'No address provided' }, { status: 400 });

  try {
    const [power, votes, authoredCount] = await Promise.all([
      getLiveGovernancePower(address),
      getUserVotes(address),
      getProposalsAuthoredCount(address)
    ]);

    return NextResponse.json({
      power,
      votes,
      authoredCount
    });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("GOVERNANCE API ERROR:", msg);
    return NextResponse.json({ 
      error: 'Governance resolution failed', 
      details: msg 
    }, { status: 500 });
  }
}
