<template>
  <v-not-found v-if="notFound" />

  <div v-else-if="error">
    <v-header-bar />
    <v-error
      v-if="error"
      icon="error_outline"
      color="warning"
      :title="$t('server_trouble')"
      :body="$t('server_trouble_copy')" />
  </div>

  <div v-else-if="fields === null">
    <v-header-bar />
    <v-loader area="content" />
  </div>

  <div v-else class="edit">
    <v-header-bar :breadcrumb="breadcrumb" info-toggle>
      <template slot="buttons">
        <v-header-button
          v-if="!newItem && !singleItem"
          icon="close"
          color="danger"
          :label="$t('delete')"
          @click="confirmRemove = true" />
        <v-header-button
          :disabled="!editing"
          :loading="saving"
          :label="$t('save')"
          :options="{
            stay: $t('save_and_stay'),
            add: $t('save_and_add'),
            copy: $t('save_as_copy'),
          }"
          icon="check"
          color="action"
          @click="save('leave')"
          @input="save" />
      </template>
    </v-header-bar>

    <v-info-sidebar wide>
      <v-activity-overview
        :collection="collection"
        :primary-key="primaryKey"
        :fields="fields"
        @reload="hydrate" />
    </v-info-sidebar>

    <v-edit-form
      :fields="fields"
      :values="values"
      :collection="collection"
      @stageValue="stageValue" />

    <portal to="modal" v-if="confirmRemove">
      <v-confirm
        :message="$t('delete_are_you_sure')"
        :busy="confirmRemoveLoading"
        @cancel="confirmRemove = false"
        @confirm="remove" />
    </portal>

    <portal to="modal" v-if="confirmNavigation">
      <v-confirm
        :message="$t('unsaved_changes_copy')"
        :confirm-text="$t('keep_editing')"
        :cancel-text="$t('discard_changes')"
        @confirm="confirmNavigation = false"
        @cancel="$router.push(leavingTo)" />
    </portal>
  </div>
</template>

<script>
import NProgress from "nprogress";
import { keyBy, mapValues } from "lodash";
import VLoader from "../components/loader.vue";
import VError from "../components/error.vue";
import VEditForm from "../components/edit-form/edit-form.vue";
import VActivityOverview from "../components/activity-overview/activity-overview.vue";
import formatTitle from "@directus/format-title";
import VNotFound from "./not-found.vue";
import store from "../store/";
import api from "../api";

function getCollectionInfo(collection) {
  if (
    collection === "directus_files" ||
    collection === "directus_users" ||
    collection === "directus_activity"
  ) {
    return true;
  }

  const { collections } = store.state;
  const collectionNames = Object.keys(collections);

  return collectionNames.includes(collection) ? collections[collection] : null;
}

function hydrate(collection, primaryKey) {
  NProgress.inc();

  return Promise.all([
    api.getFields(collection),
    api.getItems("directus_relations", {
      "filter[collection_a][eq]": collection
    }),
    primaryKey !== "+" ? api.getItem(collection, primaryKey) : null
  ]).then(([fieldsRes, relations, savedValues]) => {
    NProgress.inc();

    // https://lorenstewart.me/2016/11/21/flatten-a-multi-dimensional-array-using-es6/
    relations = relations.data;

    if (store.getters.editing === false) {
      store.dispatch("startEditing", {
        collection: collection,
        primaryKey: primaryKey,
        savedValues: (savedValues && savedValues.data) || {}
      });
    }

    function getRelationship(field) {
      const fieldID = field.field;

      const fieldRelations = relations
        .filter(relation => {
          return relation.field_a === fieldID;
        })
        .map(relation => {
          return {
            collection: relation.collection_b,
            field: relation.field_b
          };
        });

      if (fieldRelations.length === 0) return null;
      return fieldRelations[0];
    }

    return {
      fields: mapValues(keyBy(fieldsRes.data, "field"), field => ({
        ...field,
        name: formatTitle(field.field), // TODO: Map translation key to name field to support translatable field names #421 & #422
        relationship: getRelationship(field)
      }))
    };
  });
}

export default {
  name: "edit",
  components: {
    VEditForm,
    VLoader,
    VNotFound,
    VError,
    VActivityOverview
  },
  props: {
    collection: {
      type: String,
      required: true
    },
    primaryKey: {
      type: null,
      required: true
    }
  },
  data() {
    return {
      saving: false,

      fields: null,

      notFound: false,
      error: false,

      confirmRemove: false,
      confirmRemoveLoading: false,

      confirmNavigation: false,
      leavingTo: "",

      collectionInfo: null
    };
  },
  computed: {
    breadcrumb() {
      if (this.collection.startsWith("directus_")) {
        return [
          {
            name: this.$t(`collections-${this.collection}`),
            path: `/${this.collection.substring(9)}`
          },
          {
            name: this.newItem
              ? this.$t("creating_item")
              : this.$t("editing_item"),
            path: this.$route.path
          }
        ];
      }

      return [
        {
          name: this.$t("collections"),
          path: "/collections"
        },
        {
          name: this.$t(`collections-${this.collection}`),
          path: `/collections/${this.collection}`
        },
        {
          name: this.newItem
            ? this.$t("creating_item")
            : this.$t("editing_item"),
          path: this.$route.path
        }
      ];
    },
    values() {
      const edits = this.$store.state.edits.values;
      return {
        ...(this.savedValues || {}),
        ...edits
      };
    },
    editing() {
      return this.$store.getters.editing;
    },
    savedValues() {
      return this.$store.state.edits.savedValues;
    },
    newItem() {
      return this.primaryKey === "+";
    },
    singleItem() {
      return this.collectionInfo && this.collectionInfo.single === true;
    },
    primaryKeyField() {
      return this.$lodash.find(this.fields, { interface: "primary-key" }).field;
    }
  },
  methods: {
    stageValue({ field, value }) {
      this.$store.dispatch("stageValue", { field, value });
    },
    remove() {
      this.confirmRemoveLoading = true;

      this.$api
        .deleteItem(this.collection, this.primaryKey)
        .then(() => {
          this.confirmRemoveLoading = false;
          this.confirmRemove = false;
          this.$router.push(`/collections/${this.collection}`);
        })
        .catch(console.error); // eslint-disable-line no-console
    },
    discard() {},
    save(method) {
      this.saving = true;

      if (method === "copy") {
        return this.$store
          .dispatch("save", {
            primaryKey: "+",
            values: this.values
          })
          .then(res => {
            this.saving = false;
            return res.data[this.primaryKeyField];
          })
          .then(pk => {
            if (this.collection.startsWith("directus_")) {
              return this.$router.push(
                `/${this.collection.substring(9)}/${pk}`
              );
            }

            return this.$router.push(`/collections/${this.collection}/${pk}`);
          })
          .catch(console.error); // eslint-disable-line no-console
      }

      return this.$store
        .dispatch("save")
        .then(res => res.data)
        .then(savedValues => {
          this.saving = false;
          return savedValues;
        })
        .then(savedValues => {
          if (method === "leave") {
            if (this.collection.startsWith("directus_")) {
              return this.$router.push(`/${this.collection.substring(9)}`);
            }

            return this.$router.push(`/collections/${this.collection}`);
          }

          if (method === "stay") {
            if (this.newItem) {
              const primaryKey = savedValues[this.primaryKeyField];
              return this.$router.push(
                `/collections/${this.collection}/${primaryKey}`
              );
            }
            this.$store.dispatch("startEditing", {
              collection: this.collection,
              primaryKey: this.primaryKey,
              savedValues: savedValues
            });
          }

          if (method === "add") {
            if (this.collection.startsWith("directus_")) {
              return this.$router.push(`/${this.collection.substring(9)}/+`);
            }

            return this.$router.push(`/collections/${this.collection}/+`);
          }
        })
        .catch(error => {
          this.saving = false;
          console.error(error); // eslint-disable-line no-console
        });
    }
  },
  beforeRouteEnter(to, from, next) {
    const { collection, primaryKey } = to.params;

    const collectionInfo = getCollectionInfo(collection);

    if (collectionInfo === null) {
      return next(vm => (vm.$data.notFound = true));
    }

    return hydrate(collection, primaryKey)
      .then(data => {
        next(vm => {
          Object.assign(vm.$data, data, { collectionInfo });
        });
      })
      .catch(error => {
        console.error(error); // eslint-disable-line no-console
        return next(vm => (vm.$data.error = true));
      });
  },
  beforeRouteUpdate(to, from, next) {
    const { collection, primaryKey } = to.params;

    const collectionInfo = getCollectionInfo(collection);

    if (collectionInfo === null) {
      this.notFound = true;
      return next();
    }

    return hydrate(collection, primaryKey)
      .then(data => {
        this.fields = data.fields;
        this.collectionInfo = collectionInfo;
        next();
      })
      .catch(error => {
        console.error(error); // eslint-disable-line no-console
        this.error = true;
        next();
      });
  },
  beforeRouteLeave(to, from, next) {
    // If there aren't any edits, there is no reason to stop the user from navigating
    if (this.$store.getters.editing === false) return next();

    // If the modal is already open, the second navigation attempt has to be the discard changes button
    if (this.confirmNavigation === true) {
      this.$store.dispatch("discardChanges");
      return next();
    }

    this.confirmNavigation = true;
    this.leavingTo = to.fullPath;

    return next(false);
  }
};
</script>

<style lang="scss" scoped>
.edit {
  padding: var(--page-padding);
  padding-bottom: var(--page-padding-bottom);
}
</style>
