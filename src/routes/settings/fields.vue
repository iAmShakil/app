<template>
  <not-found v-if="!collectionInfo" />
  <div class="settings-fields" v-else>
    <v-header-bar :breadcrumb="breadcrumb">
       <template slot="buttons">
        <v-header-button
          icon="close"
          key="delete"
          color="danger"
          :label="$t('delete')"
          @click="confirmRemove = true" />
        <v-header-button
          icon="check"
          key="save"
          color="action"
          :loading="saving"
          :disabled="Object.keys(edits).length === 0"
          :label="$t('save')"
          @click="save" />
      </template>
    </v-header-bar>

    <h2 class="style-1">Collection</h2>
    <v-input
        id="collection-name"
        :placeholder="collection"
        :disabled="true"
        type="text"
        class="normal" />
    <em>Collection names cannot be edited at this time.</em>

    <h2 class="style-1">Fields</h2>
    <em>Field settings are saved automatically</em>

    <div class="table">
      <div class="header">
        <div class="row">
          <div class="drag"><i class="material-icons">swap_vert</i></div>
          <div>{{ $t('field')}}</div>
          <div>{{ $t('interface')}}</div>
        </div>
      </div>
      <div class="body">
        <draggable v-model="fields" @end="saveSort">
          <div class="row" v-for="field in fields" :key="field.field" @click="startEditingField(field)">
            <div class="drag"><i class="material-icons">drag_handle</i></div>
            <div>{{ $helpers.formatTitle(field.field) }}</div>
            <div>{{ ($store.state.extensions.interfaces[field.interface] && $store.state.extensions.interfaces[field.interface].name) || "--" }}</div>
            <button class="remove-field" @click.stop="warnRemoveField(field.field)"><i class="material-icons">close</i></button>
          </div>
        </draggable>
      </div>
    </div>

    <v-button @click="startEditingField({})">New Field</v-button>

    <h2 class="style-1">Additional Settings</h2>
    <v-edit-form
      v-if="fields"
      :fields="directusFields"
      :values="collectionInfo"
      collection="directus_collections"
      @stageValue="stageValue" />

    <portal to="modal" v-if="confirmRemove">
      <v-confirm
        color="danger"
        :message="$t('delete_collection_are_you_sure')"
        :confirm-text="$t('delete')"
        @cancel="confirmRemove = false"
        @confirm="remove" />
    </portal>

    <portal to="modal" v-if="confirmFieldRemove">
      <v-confirm
        color="danger"
        :message="$t('delete_field_are_you_sure', { field: fieldToBeRemoved })"
        :confirm-text="$t('delete')"
        @cancel="confirmFieldRemove = false"
        @confirm="removeField(fieldToBeRemoved)" />
    </portal>

    <v-field-setup
      v-if="editingField"
      :fieldInfo="fieldBeingEdited"
      @close="editingField = false"
      @save="setFieldSettings" />
  </div>
</template>

<script>
import { keyBy } from "lodash";
import formatTitle from "@directus/format-title";
import VEditForm from "../../components/edit-form/edit-form.vue";
import api from "../../api.js";
import NotFound from "../not-found.vue";
import VFieldSetup from "../../components/field-setup.vue";

export default {
  name: "settings-fields",
  components: {
    VEditForm,
    NotFound,
    VFieldSetup
  },
  props: {
    collection: {
      type: String,
      required: true
    }
  },
  data() {
    return {
      saving: false,

      fields: null,
      directusFields: null,

      notFound: false,
      error: false,

      confirmRemove: false,
      confirmRemoveLoading: false,

      confirmNavigation: false,
      leavingTo: "",

      edits: {},

      fieldEdits: {},
      fieldBeingEdited: {},
      fieldToBeRemoved: null,
      confirmFieldRemove: false,

      editingField: false,

      count: "--"
    };
  },
  created() {
    this.getItemCount();
  },
  watch: {
    collection() {
      this.getItemCount();
    }
  },
  computed: {
    breadcrumb() {
      return [
        {
          name: this.$t("settings"),
          path: "/settings",
          color: "warning"
        },
        {
          name: this.$t("collections"),
          path: "/settings/collections"
        },
        {
          name: this.$t(`collections-${this.collection}`),
          path: `/settings/collections/${this.collection}`
        }
      ];
    },
    collectionInfo() {
      return this.$store.state.collections[this.collection];
    },
    fieldsWithSort() {
      return this.fields.map((field, index) => ({
        ...field,
        sort: index + 1
      }));
    }
  },
  methods: {
    getItemCount() {
      if (!this.collectionInfo) return;

      this.$api
        .getItems(this.collection, {
          fields: "id",
          meta: "total_count"
        })
        .then(res => res.meta)
        .then(meta => {
          this.count = meta.total_count;
        })
        .catch(console.error); // eslint-disable-line no-console
    },
    remove() {
      this.$api
        .deleteCollection(this.collection)
        .then(() => {
          this.$store.dispatch("removeCollection", this.collection);
          this.$router.push("/settings/collections");
        })
        .catch(console.error); // eslint-disable-line no-console
    },
    save() {
      this.saving = true;

      this.$api
        .updateCollection(this.collection, this.edits)
        .then(() => {
          this.saving = false;
          this.$store.dispatch("updateCollection", {
            collection: this.collection,
            edits: this.edits
          });
          this.$router.push("/settings/collections");
        })
        .catch(console.error); // eslint-disable-line no-console
    },
    stageValue({ field, value }) {
      if (value === this.collectionInfo[field]) {
        this.$delete(this.edits, field);
        return;
      }

      this.$set(this.edits, field, value);
    },
    setFieldSettings(fieldInfo) {
      const existingField = fieldInfo.id != null;

      if (existingField) {
        return this.$api
          .updateField(this.collection, fieldInfo.field, fieldInfo)
          .then(res => res.data)
          .then(savedFieldInfo => {
            this.editingField = false;
            this.fieldBeingEdited = null;
            this.fields = this.fields.map(field => {
              if (field.id === savedFieldInfo.id) return savedFieldInfo;
              return field;
            });
          })
          .catch(console.error); // eslint-disable-line no-console
      }

      // Prevents the API from trying to search for the ID
      delete fieldInfo.id;

      fieldInfo.collection = this.collection;

      return this.$api
        .createField(this.collection, fieldInfo)
        .then(res => res.data)
        .then(savedFieldInfo => {
          this.editingField = false;
          this.fieldBeingEdited = null;
          this.fields = [...this.fields, savedFieldInfo];
        })
        .catch(console.error); // eslint-disable-line no-console
    },
    startEditingField(field) {
      this.fieldBeingEdited = field;
      this.editingField = true;
    },
    warnRemoveField(fieldName) {
      this.fieldToBeRemoved = fieldName;
      this.confirmFieldRemove = true;
    },
    removeField(fieldName) {
      this.removingField = true;

      this.$api
        .deleteField(this.collection, fieldName)
        .then(() => {
          this.fields = this.fields.filter(({ field }) => field !== fieldName);
          this.removingField = false;
          this.fieldToBeRemoved = null;
          this.confirmFieldRemove = false;
        })
        .catch(console.error); // eslint-disable-line no-console
    },
    saveSort() {
      const fieldUpdates = this.fieldsWithSort.map(field => ({
        field: field.field,
        sort: field.sort
      }));

      this.$api
        .updateFields(this.collection, fieldUpdates)
        .then(res => res.data)
        .then(fields => {
          this.fields = fields;
        })
        .catch(console.error); // eslint-disable-line no-console
    }
  },
  beforeRouteEnter(to, from, next) {
    const { collection } = to.params;

    return Promise.all([
      api.getFields("directus_collections"),
      api.getFields(collection, {
        sort: "sort"
      })
    ])
      .then(([directusRes, fieldsRes]) => ({
        directusFields: directusRes.data,
        fields: fieldsRes.data
      }))
      .then(({ directusFields, fields }) => {
        next(vm => {
          vm.$data.directusFields = keyBy(
            directusFields.map(field => ({
              ...field,
              name: formatTitle(field.field)
            })),
            "field"
          );

          vm.$data.fields = fields
            .map(field => ({
              ...field,
              name: formatTitle(field.field)
            }))
            .sort((a, b) => {
              if (a.sort == null) return 1;
              return a.sort > b.sort ? 1 : -1;
            });
        });
      })
      .catch(error => {
        next(vm => {
          vm.$data.error = error;
        });
      });
  }
};
</script>

<style lang="scss" scoped>
.settings-fields {
  padding: var(--page-padding);
}

h2 {
  margin-bottom: 20px;

  &:not(:first-of-type) {
    margin-top: 60px;
  }
}

.table {
  background-color: var(--white);
  border: var(--input-border-width) solid var(--lighter-gray);
  border-radius: var(--border-radius);
  border-spacing: 0;
  width: 100%;
  margin: 20px 0;

  .header {
    color: var(--gray);
    font-size: 10px;
    text-transform: uppercase;
    font-weight: 700;
    border-bottom: 1px solid var(--lighter-gray);
  }

  .row {
    display: flex;
    align-items: center;

    > div {
      padding: 3px 5px;

      &:not(.drag) {
        flex-basis: 200px;
      }
    }
  }

  .body {
    .row {
      cursor: pointer;
      position: relative;

      &:hover {
        background-color: var(--lightest-gray);
      }
    }

    .drag {
      user-select: none;
      cursor: -webkit-grab;
      color: var(--lighter-gray);

      &:hover {
        color: var(--dark-gray);
      }
    }
  }
}

.remove-field {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);

  i {
    color: var(--gray);
  }

  &:hover {
    i {
      color: var(--danger);
    }
  }
}
</style>
