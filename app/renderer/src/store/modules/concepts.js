import conceptsApi from '@/store/api/concepts'
import productionsStore from '@/store/modules/productions'
import { PAGE_SIZE } from '@/lib/pagination'
import { buildNameIndex, indexSearch } from '@/lib/indexing'
import { getKeyWords } from '@/lib/filtering'
import { v4 as uuidv4 } from 'uuid'

import {
  CLEAR_CONCEPTS,
  LOAD_CONCEPTS_START,
  LOAD_CONCEPTS_ERROR,
  LOAD_CONCEPTS_END,
  ADD_CONCEPT,
  UPDATE_CONCEPT,
	UPDATE_CONCEPT_END,
  REMOVE_CONCEPT,
  SET_CONCEPT_SEARCH,
  DISPLAY_MORE_CONCEPTS,
  SET_CURRENT_PRODUCTION,
  RESET_ALL
} from '@/store/mutation-types'

const helpers = {
  getCurrentProduction() {
    return productionsStore.getters.currentProduction(productionsStore.state)
  },

	populateConcept(concept) {
    concept.full_name = 'Concept'
    concept.last_comment_date = concept.tasks?.[0]?.last_comment_date
    concept.tasks?.forEach(task => {
      helpers.populateTask(task, concept)
    })
  }
}

const cache = {
  conceptIndex: {},
  concepts: []
}

const initialState = {
  conceptMap: new Map(),
  filteredConcepts: [],
  displayedConcepts: [],
  displayedConceptsLength: 0,
  conceptSearchText: '',
  conceptSearchQueries: [],
  conceptSorting: [],
  isConceptsLoading: false,
  isConceptsLoadingError: false,
  conceptCreated: '',
  conceptListScrollPosition: 0
}

const state = {
  ...initialState
}

const getters = {
  concepts: (state) => cache.concepts,
  conceptMap: (state) => state.conceptMap,
  conceptSearchText: (state) => state.conceptSearchText,
  conceptSearchQueries: (state) => state.conceptSearchQueries,
  isConceptsLoading: (state) => state.isConceptsLoading,
  isConceptsLoadingError: (state) => state.isConceptsLoadingError,
  displayedConcepts: (state) => state.displayedConcepts,
  displayedConceptsLength: (state) => state.displayedConceptsLength,
  conceptListScrollPosition: (state) => state.conceptListScrollPosition,
  conceptCreated: (state) => state.conceptCreated
}

const actions = {
  loadConcepts({ commit, state, rootGetters }) {
    const production = rootGetters.currentProduction

    if (state.isConceptsLoading) {
      return Promise.resolve([])
    }

    commit(LOAD_CONCEPTS_START)
    return conceptsApi
      .getConcepts(production)
      .then((concepts) => {
        commit(LOAD_CONCEPTS_END, {
          production,
          concepts
        })
        return Promise.resolve(concepts)
      })
      .catch((err) => {
        console.error('an error occurred while loading concepts', err)
        commit(LOAD_CONCEPTS_ERROR)
        return Promise.resolve([])
      })
  },

  getConcept({ commit, state, rootGetters }, conceptId) {
    return conceptsApi.getConcept(conceptId)
  },

	async newConcepts({ dispatch }, forms) {
    return Promise.all(forms.map(form => dispatch('newConcept', form)))
  },

  async newConcept({ commit, dispatch, state, rootGetters }, form) {
    const production = rootGetters.currentProduction

    // Create Entity
    const entity = {
        name: form.get('file').name + '-' + uuidv4(), // unique and mandatory field
        project_id: production.id
    }
    const concept = await conceptsApi.newConcept(entity)

    // Create task
    const conceptTaskType  = rootGetters.taskTypes.find(
      taskType => taskType.for_entity === 'Concept'
    )
		
		console.log('creating task', concept.id, production.id, conceptTaskType.id)
    const task = await dispatch('createTask', {
			entityId: concept.id,
			projectId: production.id,
			taskTypeId: conceptTaskType.id,
			type: 'concepts'
    })

		console.log('task', task)

    // Create comment with preview
		const { preview } = await dispatch('commentTaskWithPreview', {
			taskId: task.id,
      taskStatusId: task.task_status_id,
      form
		})
		await dispatch('setLastTaskPreview', task.id)

		concept.tasks = [task]
    concept.preview_file_id = preview.id
    helpers.populateConcept(concept)

    commit(UPDATE_CONCEPT_END, concept)
    return concept
  },

  editConcept({ commit, state }, data) {
    const existingConcept =
      data.name &&
      cache.concepts.find((concept) => {
        return concept.name === data.name && data.id !== concept.id
      })
    if (existingConcept) {
      return Promise.reject(new Error('Concept already exists'))
    }
    commit(UPDATE_CONCEPT, data)
    return conceptsApi.updateConcept(data).then((concept) => {
      return Promise.resolve(concept)
    })
  },

  deleteConcept({ commit, state }, concept) {
    return conceptsApi.deleteConcept(concept).then(() => {
      commit(REMOVE_CONCEPT, concept)
      return Promise.resolve(concept)
    })
  },

  setConceptSearch({ commit, state, rootGetters }, conceptSearch) {
    const production = rootGetters.currentProduction
    commit(SET_CONCEPT_SEARCH, {
      conceptSearch,
      production
    })
  },

  displayMoreConcepts({ commit, rootGetters }) {
    commit(DISPLAY_MORE_CONCEPTS, {
      production: rootGetters.currentProduction
    })
  }
}

const mutations = {
  [CLEAR_CONCEPTS](state) {
    cache.concepts = []
    state.conceptMap = new Map()
    cache.result = []
    state.displayedConcepts = []
    state.conceptSearchQueries = []
  },

  [LOAD_CONCEPTS_START](state) {
    cache.concepts = []
    state.conceptMap = new Map()
    state.isConceptsLoading = true
    state.isConceptsLoadingError = false
    cache.conceptIndex = {}
    state.displayedConcepts = []
    state.conceptSearchQueries = []
  },

  [LOAD_CONCEPTS_ERROR](state) {
    state.isConceptsLoading = false
    state.isConceptsLoadingError = true
  },

  [LOAD_CONCEPTS_END](state, { production, concepts }) {
    concepts = concepts.sort((a, b) => a.name.localeCompare(b.name))
    cache.concepts = concepts
    cache.conceptIndex = buildNameIndex(concepts)
    state.conceptMap = new Map()

    concepts.forEach((concept) => {
      concept.production_id = production.id
      concept.project_name = production.name
      concept.production_name = production.name
      state.conceptMap.set(concept.id, concept)
    })

    const displayedConcepts = cache.concepts.slice(0, PAGE_SIZE)
    state.displayedConcepts = displayedConcepts
    state.displayedConceptsLength = cache.concepts.length
    state.isConceptsLoading = false
    state.isConceptsLoadingError = false
  },

  [ADD_CONCEPT](state, { concept }) {
    concept.production_id = helpers.getCurrentProduction().id
    concept.project_name = helpers.getCurrentProduction().name
    concept.production_name = helpers.getCurrentProduction().name
    cache.concepts.push(concept)
    cache.concepts = cache.concepts.sort((a, b) => a.name.localeCompare(b.name))
    state.conceptMap.set(concept.id, concept)
    state.displayedConcepts.push(concept)
    state.displayedConcepts = state.displayedConcepts.sort((a, b) => a.name.localeCompare(b.name))
    state.displayedConceptsLength = cache.concepts.length
    cache.conceptIndex = buildNameIndex(cache.concepts)
  },

  [UPDATE_CONCEPT](state, concept) {
    Object.assign(state.conceptMap.get(concept.id), concept)
    cache.conceptIndex = buildNameIndex(cache.concepts)
  },

	[UPDATE_CONCEPT_END](state, newConcept) {
    const concept = state.conceptMap.get(newConcept.id)
    if (concept?.id) {
      Object.assign(concept, newConcept)
      state.conceptMap.delete(concept.id)
      state.conceptMap.set(concept.id, concept)
    } else {
      state.concepts.push(newConcept)
      state.conceptMap.set(newConcept.id, newConcept)
    }
  },

  [REMOVE_CONCEPT](state, conceptToDelete) {
    if (state.conceptMap.get(conceptToDelete.id)) {
      state.conceptMap.delete(conceptToDelete.id)
      cache.concepts = cache.concepts.filter(c => c.id !== conceptToDelete.id)
      state.displayedConcepts = state.displayedConcepts.filter(c => c.id !== conceptToDelete.id)
      state.displayedConceptsLength = cache.concepts.length
      cache.conceptIndex = buildNameIndex(cache.concepts)
    }
  },

  [SET_CONCEPT_SEARCH](state, { conceptSearch, production }) {
    const keywords = getKeyWords(conceptSearch) || []
    const result = indexSearch(cache.conceptIndex, keywords) || cache.concepts
    state.displayedConcepts = result.slice(0, PAGE_SIZE)
    state.displayedConceptsLength = result.length
    state.conceptSearchText = conceptSearch
  },

  [DISPLAY_MORE_CONCEPTS](state, { production }) {
    const concepts = cache.concepts
    const newLength = state.displayedConcepts.length + PAGE_SIZE
    if (newLength < concepts.length + PAGE_SIZE) {
      state.displayedConcepts = concepts.slice(0, state.displayedConcepts.length + PAGE_SIZE)
    }
  },

  [SET_CURRENT_PRODUCTION](state, production) {
    state.conceptSearchText = ''
  },

  [RESET_ALL](state) {
    cache.concepts = []
    cache.conceptIndex = {}
    Object.assign(state, { ...initialState })
  }
}

export default {
  // namespaced: true,
  state,
  getters,
  actions,
  mutations,
  cache
}
