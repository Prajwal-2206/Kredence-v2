export async function getUserVotes(address: string) {
  const query = `
    query {
      votes(
        first: 10,
        where: { voter: "${address}" },
        orderBy: "created",
        orderDirection: desc
      ) {
        id
        choice
        proposal {
          id
          title
          state
          space {
            id
            name
          }
          choices
        }
      }
    }
  `;
  
  try {
    const res = await fetch("https://hub.snapshot.org/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
      next: { revalidate: 300 } // Basic ISR cache for 5 minutes
    });
    const json = await res.json();
    return json?.data?.votes || [];
  } catch (error) {
    console.error("Snapshot GraphQL Error (Votes):", error);
    return []; // Fail gracefully with empty array so UI doesn't crash
  }
}

export async function getProposalsAuthoredCount(address: string) {
  const query = `
    query {
      proposals(
        where: { author: "${address}" },
        first: 100
      ) {
        id
      }
    }
  `;

  try {
    const res = await fetch("https://hub.snapshot.org/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
      next: { revalidate: 3600 } // Cache 1hr
    });
    const json = await res.json();
    return json?.data?.proposals?.length || 0;
  } catch (error) {
    console.error("Snapshot GraphQL Error (Proposals):", error);
    return 0;
  }
}
