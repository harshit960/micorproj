import 'server-only'

export interface LcStats {
  username: string
  total: number
  easy: number
  medium: number
  hard: number
  ranking: number | null
  rating: number | null
  contests: number
}

const QUERY = `query($u:String!){
  matchedUser(username:$u){ profile{ ranking } submitStatsGlobal{ acSubmissionNum{ difficulty count } } }
  userContestRanking(username:$u){ rating attendedContestsCount }
}`

export async function fetchLeetCode(username: string): Promise<LcStats | null> {
  if (!username) return null
  try {
    const res = await fetch('https://leetcode.com/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Referer: 'https://leetcode.com' },
      body: JSON.stringify({ query: QUERY, variables: { u: username } }),
      next: { revalidate: 1800 },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const { data } = await res.json()
    const u = data?.matchedUser
    if (!u) return null
    const n = (d: string) => u.submitStatsGlobal.acSubmissionNum.find((x: { difficulty: string }) => x.difficulty === d)?.count ?? 0
    return {
      username,
      total: n('All'),
      easy: n('Easy'),
      medium: n('Medium'),
      hard: n('Hard'),
      ranking: u.profile?.ranking ?? null,
      rating: data.userContestRanking?.rating ? Math.round(data.userContestRanking.rating) : null,
      contests: data.userContestRanking?.attendedContestsCount ?? 0,
    }
  } catch {
    return null
  }
}
