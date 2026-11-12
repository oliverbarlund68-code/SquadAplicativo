import { getCurrentUser } from '@/lib/app-auth'
import { getPayloadClient } from '@/lib/payload'
import type { Media } from '@/payload-types'
import SquadFinderClient, { type PlayerView } from './SquadFinderClient'

export default async function HomePage() {
  const [payload, currentUser] = await Promise.all([getPayloadClient(), getCurrentUser()])

  const result = await payload.find({
    collection: 'player-profiles',
    depth: 1,
    limit: 40,
    overrideAccess: false,
    sort: '-matchScore',
    where: {
      isActive: { equals: true },
    },
  })

  const players = result.docs.flatMap<PlayerView>((profile) => {
    const avatar =
      profile.avatar && typeof profile.avatar === 'object' ? (profile.avatar as Media) : null
    if (!avatar?.url) return []

    return [
      {
        id: profile.id,
        name: profile.displayName,
        age: profile.age,
        handle: profile.handle,
        city: profile.city,
        region: profile.region,
        game: profile.game,
        rank: profile.rank,
        style: profile.gameplayStyle,
        platform: profile.platform,
        bio: profile.bio,
        availability: profile.availability,
        image: avatar.url,
        imageAlt: avatar.alt,
        color: profile.accentColor ?? '#d7ff3f',
        match: profile.matchScore,
        online: profile.isOnline ?? false,
      },
    ]
  })

  if (!players.length) {
    return (
      <main className="empty-state">
        <div>
          <span>SquadFinder</span>
          <h1>Nenhum jogador disponível agora.</h1>
          <p>Volte em breve para descobrir novos parceiros de jogo.</p>
        </div>
      </main>
    )
  }

  return (
    <SquadFinderClient
      players={players}
      currentUser={
        currentUser
          ? {
              displayName: currentUser.displayName,
              email: currentUser.email,
            }
          : null
      }
    />
  )
}
