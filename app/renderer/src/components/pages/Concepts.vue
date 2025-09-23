<template>
  <div class="columns fixed-page">
    <div class="column main-column">
      <div class="concepts page">
        <div class="page-header flexrow">
          <div class="flexrow-item">
            <page-title :text="$t('concepts.title')" />
          </div>
          <div class="filler" />
          <div class="flexrow-item">
            <button
              class="button is-primary"
              @click="onAddConceptClicked"
            >
              {{ $t('concepts.actions.add') }}
            </button>
          </div>
          <div class="flexrow-item">
            <search-field
              :label="$t('concepts.fields.search')"
              :value="conceptSearchText"
              @input="setConceptSearch"
            />
          </div>
        </div>

        <div class="concept-list">
          <div
            v-if="isConceptsLoading"
            class="has-text-centered"
          >
            <spinner :animation="'pulse'" />
          </div>
          
          <div
            v-else-if="isConceptsLoadingError"
            class="has-text-centered"
          >
            <p class="error">
              {{ $t('concepts.errors.loading') }}
            </p>
          </div>

          <div
            v-else-if="displayedConcepts?.length === 0"
            class="has-text-centered"
          >
            <p class="empty">
              {{ $t('concepts.empty') }}
            </p>
          </div>

          <div
            v-else
            class="concept-grid"
          >
            <div
              v-for="concept in displayedConcepts"
              :key="concept.id"
              class="concept-card"
            >
              <div class="concept-thumbnail">
                <entity-thumbnail
                  :entity="concept"
                  :empty-height="200"
                  :empty-width="300"
                  :height="200"
                  :width="300"
                />
              </div>
              <div class="concept-content">
                <div
                  v-if="concept.data && Object.keys(concept.data).length > 0"
                  class="concept-data"
                >
                  <div
                    v-for="(value, key) in concept.data"
                    :key="key"
                    class="concept-data-item"
                  >
                    <strong>{{ key }}:</strong> {{ value }}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div
            v-if="displayedConceptsLength > displayedConcepts?.length"
            class="has-text-centered mt2"
          >
            <button
              class="button is-primary"
              @click="displayMoreConcepts"
            >
              {{ $t('concepts.actions.load_more') }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <add-preview-modal
      ref="add-concept-modal"
      :active="modals.addConcept"
      :is-loading="loading.addConcept"
      :is-error="errors.addConcept"
      :title="$t('concepts.actions.add')"
      :is-concept="true"
      @cancel="modals.addConcept = false"
      @fileselected="onConceptFileSelected"
      @confirm="confirmAddConceptModal"
    />
  </div>
</template>

<script>
import { mapGetters, mapActions } from 'vuex'
import EntityThumbnail from '@/components/widgets/EntityThumbnail.vue'
import PageTitle from '@/components/widgets/PageTitle.vue'
import SearchField from '@/components/widgets/SearchField.vue'
import Spinner from '@/components/widgets/Spinner.vue'
import AddPreviewModal from '@/components/modals/AddPreviewModal.vue'

export default {
  name: 'Concepts',

  components: {
    EntityThumbnail,
    PageTitle,
    SearchField,
    Spinner,
    AddPreviewModal
  },

  data() {
    return {
      modals: {
        addConcept: false
      },
      loading: {
        addConcept: false
      },
      errors: {
        addConcept: false
      },
      conceptFormData: null
    }
  },

  computed: {
    ...mapGetters([
      'displayedConcepts',
      'displayedConceptsLength',
      'conceptSearchText',
      'isConceptsLoading',
      'isConceptsLoadingError'
    ]),
    ...mapGetters(['currentProduction'])
  },

  async mounted() {
    await this.loadConcepts()
  },

  methods: {
    ...mapActions([
      'loadConcepts',
      'setConceptSearch',
      'displayMoreConcepts',
      'newConcepts'
    ]),

    onAddConceptClicked() {
      this.modals.addConcept = true
    },

    onConceptFileSelected(forms) {
      this.conceptFormData = forms
    },

    async confirmAddConceptModal(forms) {
      this.loading.addingConcept = true
      try {
        await this.newConcepts(forms)
        this.closeAddConceptModal()
      } catch (err) {
        console.error(err)
        this.errors.addingConcept = true
      } finally {
        this.loading.addingConcept = false
      }
    },
  }
}
</script>

<style lang="scss" scoped>
.concept-list {
  margin-top: 1rem;
}

.concept-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}

.concept-card {
  background: var(--background);
  border: 1px solid var(--border);
  border-radius: 4px;
  overflow: hidden;
  transition: box-shadow 0.2s ease;

  &:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
}

.concept-thumbnail {
  width: 100%;
  height: 200px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--background-secondary);
}

.concept-content {
  padding: 1rem;
}

.concept-header {
  margin-bottom: 0.5rem;
}

.concept-name {
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0;
  color: var(--text);
}

.concept-description {
  margin-bottom: 0.5rem;
  
  p {
    margin: 0;
    color: var(--text-secondary);
    font-size: 0.9rem;
    line-height: 1.4;
  }
}

.concept-data {
  margin-top: 0.5rem;
}

.concept-data-item {
  font-size: 0.85rem;
  margin-bottom: 0.25rem;
  color: var(--text-secondary);
  
  strong {
    color: var(--text);
  }
}

.error {
  color: var(--error);
  font-weight: 500;
}

.empty {
  color: var(--text-secondary);
  font-style: italic;
}

.mt2 {
  margin-top: 2rem;
}
</style>