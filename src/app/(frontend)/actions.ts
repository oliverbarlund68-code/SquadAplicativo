'use server'

import { getPayload } from 'payload'
import configPromise from '@/payload.config'
import { revalidatePath } from 'next/cache'

// Inicializa a instância local do Payload CMS
async function getPayloadClient() {
  return await getPayload({ config: configPromise })
}

/**
 * 1. Registar um Swipe (Like ou Pass)
 */
export async function recordSwipeAction({
  fromUserId,
  toPlayerProfileId,
  action,
}: {
  fromUserId: string
  toPlayerProfileId: string
  action: 'like' | 'pass'
}) {
  try {
    const payload = await getPayloadClient()

    // 1. Obter ou validar o PlayerProfile do utilizador atual
    const userProfiles = await payload.find({
      collection: 'player-profiles',
      where: {
        user: {
          equals: fromUserId,
        },
      },
      limit: 1,
    })

    if (!userProfiles.docs.length) {
      return { success: false, error: 'Perfil do jogador atual não encontrado.' }
    }

    const currentProfileId = userProfiles.docs[0].id

    // 2. Verificar se já existe um swipe registado para este destino
    const existingSwipes = await payload.find({
      collection: 'swipes',
      where: {
        and: [
          { fromProfile: { equals: currentProfileId } },
          { toProfile: { equals: toPlayerProfileId } },
        ],
      },
      limit: 1,
    })

    if (existingSwipes.docs.length > 0) {
      return { success: false, error: 'Já avaliou este perfil anteriormente.' }
    }

    // 3. Criar o novo registo de Swipe
    await payload.create({
      collection: 'swipes',
      data: {
        fromProfile: currentProfileId,
        toProfile: toPlayerProfileId,
        action,
      },
    })

    let isMatch = false

    // 4. Se a ação for 'like', verificar se houve Match recíproco
    if (action === 'like') {
      const reciprocalSwipe = await payload.find({
        collection: 'swipes',
        where: {
          and: [
            { fromProfile: { equals: toPlayerProfileId } },
            { toProfile: { equals: currentProfileId } },
            { action: { equals: 'like' } },
          ],
        },
        limit: 1,
      })

      if (reciprocalSwipe.docs.length > 0) {
        isMatch = true
      }
    }

    // Revalida a rota para atualizar o feed de cartões
    revalidatePath('/')

    return { success: true, isMatch }
  } catch (error) {
    console.error('Erro ao registar swipe:', error)
    return { success: false, error: 'Falha ao processar o swipe.' }
  }
}

/**
 * 2. Obter Feed de Perfis Disponíveis (Filtrando os que já receberam Swipe)
 */
export async function getPlayerFeedAction({
  userId,
  selectedTagIds = [],
  limit = 10,
}: {
  userId: string
  selectedTagIds?: string[]
  limit?: number
}) {
  try {
    const payload = await getPayloadClient()

    // 1. Obter o perfil do utilizador
    const userProfiles = await payload.find({
      collection: 'player-profiles',
      where: {
        user: { equals: userId },
      },
      limit: 1,
    })

    if (!userProfiles.docs.length) {
      return { success: false, profiles: [], error: 'Perfil do utilizador não encontrado.' }
    }

    const currentProfileId = userProfiles.docs[0].id

    // 2. Procurar todos os perfis aos quais o utilizador já deu swipe
    const previousSwipes = await payload.find({
      collection: 'swipes',
      where: {
        fromProfile: { equals: currentProfileId },
      },
      limit: 500,
    })

    const swipedProfileIds = previousSwipes.docs.map((swipe) =>
      typeof swipe.toProfile === 'object' ? swipe.toProfile.id : swipe.toProfile
    )

    // IDs a excluir: o próprio utilizador + os que já receberam swipe
    const excludeIds = [currentProfileId, ...swipedProfileIds]

    // 3. Montar a query de busca no Payload
    const whereQuery: any = {
      id: {
        not_in: excludeIds,
      },
    }

    // Adiciona filtro por Tags caso tenham sido selecionadas
    if (selectedTagIds.length > 0) {
      whereQuery.tags = {
        in: selectedTagIds,
      }
    }

    // 4. Buscar os perfis disponíveis no banco
    const availableProfiles = await payload.find({
      collection: 'player-profiles',
      where: whereQuery,
      limit,
      depth: 2, // Traz relações como Tags e Avatar (Media) populadas
    })

    return {
      success: true,
      profiles: availableProfiles.docs,
    }
  } catch (error) {
    console.error('Erro ao procurar feed de jogadores:', error)
    return { success: false, profiles: [], error: 'Falha ao carregar perfis.' }
  }
}

/**
 * 3. Procurar Tags Disponíveis para Filtros
 */
export async function getAvailableTagsAction() {
  try {
    const payload = await getPayloadClient()
    const tags = await payload.find({
      collection: 'tags',
      limit: 100,
    })

    return { success: true, tags: tags.docs }
  } catch (error) {
    console.error('Erro ao procurar tags:', error)
    return { success: false, tags: [], error: 'Falha ao carregar tags.' }
  }
}