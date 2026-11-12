'use client'

import React, { useState, useEffect } from 'react'
import { recordSwipeAction, getPlayerFeedAction, getAvailableTagsAction } from './actions'

interface PlayerProfile {
  id: string
  displayName?: string
  bio?: string
  avatar?: {
    url?: string
    alt?: string
  }
  tags?: Array<{ id: string; name: string }>
}

interface Tag {
  id: string
  name: string
}

export default function SquadFinderClient({ currentUserId }: { currentUserId: string }) {
  const [profiles, setProfiles] = useState<PlayerProfile[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [matchProfile, setMatchProfile] = useState<PlayerProfile | null>(null)

  // 1. Carregar Tags e Feed de Jogadores ao iniciar
  useEffect(() => {
    async function loadInitialData() {
      setLoading(true)
      const tagsRes = await getAvailableTagsAction()
      if (tagsRes.success) {
        setTags(tagsRes.tags as Tag[])
      }

      await loadFeed()
      setLoading(false)
    }

    loadInitialData()
  }, [currentUserId])

  // 2. Função para carregar/atualizar o Feed
  async function loadFeed(tagId?: string | null) {
    setLoading(true)
    const filterTags = tagId ? [tagId] : []
    const feedRes = await getPlayerFeedAction({
      userId: currentUserId,
      selectedTagIds: filterTags,
      limit: 10,
    })

    if (feedRes.success) {
      setProfiles(feedRes.profiles as PlayerProfile[])
    }
    setLoading(false)
  }

  // 3. Filtrar por Tag
  const handleTagFilter = (tagId: string) => {
    const nextTag = selectedTagId === tagId ? null : tagId
    setSelectedTagId(nextTag)
    loadFeed(nextTag)
  }

  // 4. Executar o Swipe (Like ou Pass)
  const handleSwipe = async (action: 'like' | 'pass') => {
    if (profiles.length === 0) return

    const currentTarget = profiles[0]
    
    // Remove o cartão atual da UI imediatamente (UX fluida)
    setProfiles((prev) => prev.slice(1))

    // Regista o swipe no Payload CMS via Server Action
    const result = await recordSwipeAction({
      fromUserId: currentUserId,
      toPlayerProfileId: currentTarget.id,
      action,
    })

    if (result.success && result.isMatch) {
      setMatchProfile(currentTarget)
    }
  }

  const currentCard = profiles[0]

  return (
    <div className="max-w-md mx-auto p-4 flex flex-col gap-6">
      {/* Filtros de Tags */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {tags.map((tag) => (
          <button
            key={tag.id}
            onClick={() => handleTagFilter(tag.id)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              selectedTagId === tag.id
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            {tag.name}
          </button>
        ))}
      </div>

      {/* Área do Cartão / Feed */}
      {loading ? (
        <div className="h-96 flex items-center justify-center border border-gray-800 rounded-2xl bg-gray-900 text-gray-400">
          A carregar novos perfis...
        </div>
      ) : currentCard ? (
        <div className="relative h-96 border border-gray-800 rounded-2xl bg-gray-900 overflow-hidden shadow-xl flex flex-col justify-end p-6">
          {currentCard.avatar?.url && (
            <img
              src={currentCard.avatar.url}
              alt={currentCard.avatar.alt || currentCard.displayName}
              className="absolute inset-0 w-full h-full object-cover z-0 opacity-60"
            />
          )}

          <div className="relative z-10 flex flex-col gap-2">
            <h2 className="text-2xl font-bold text-white">
              {currentCard.displayName || 'Jogador sem nome'}
            </h2>
            <p className="text-sm text-gray-300 line-clamp-3">
              {currentCard.bio || 'Sem biografia disponível.'}
            </p>

            {/* Tags do Perfil */}
            <div className="flex flex-wrap gap-1 mt-2">
              {currentCard.tags?.map((t) => (
                <span
                  key={t.id}
                  className="px-2 py-0.5 bg-black/50 backdrop-blur-md text-xs text-indigo-300 rounded"
                >
                  {t.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="h-96 flex flex-col items-center justify-center border border-gray-800 rounded-2xl bg-gray-900 text-gray-400 text-center p-6 gap-4">
          <p className="text-lg">Não há mais jogadores disponíveis de momento!</p>
          <button
            onClick={() => loadFeed(selectedTagId)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm transition-colors"
          >
            Recarregar Feed
          </button>
        </div>
      )}

      {/* Botões de Ação (Pass / Like) */}
      {currentCard && !loading && (
        <div className="flex gap-4 justify-center">
          <button
            onClick={() => handleSwipe('pass')}
            className="w-16 h-16 rounded-full bg-gray-800 text-red-400 hover:bg-red-950/40 border border-red-500/20 flex items-center justify-center text-xl font-bold transition-all"
          >
            ✕
          </button>
          <button
            onClick={() => handleSwipe('like')}
            className="w-16 h-16 rounded-full bg-indigo-600 text-white hover:bg-indigo-500 flex items-center justify-center text-xl font-bold shadow-lg shadow-indigo-500/30 transition-all"
          >
            ♥
          </button>
        </div>
      )}

      {/* Modal de Match */}
      {matchProfile && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-indigo-500/30 p-6 rounded-2xl max-w-sm w-full text-center flex flex-col items-center gap-4 shadow-2xl">
            <h3 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-pink-500">
              É UM MATCH!
            </h3>
            <p className="text-gray-300 text-sm">
              Tu e o <span className="text-white font-semibold">{matchProfile.displayName}</span> demonstraram interesse mútuo!
            </p>
            <button
              onClick={() => setMatchProfile(null)}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg transition-colors"
            >
              Continuar a procurar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}