<template>
  <v-error
    v-if="items.error || fields.error"
    icon="warning"
    :color="danger"
    :title="$t('server_error')"
    :body="$t('server_error_copy')" />

  <v-error
    v-else-if="items.fields && Object.keys(items.fields).length === 0"
    icon="build"
    :title="$t('no_fields')"
    :body="$t('no_fields_body')" />

  <v-error
    v-else-if="items.meta && items.meta.total_count === 0"
    icon="web_asset"
    :title="$t('empty_collection')"
    :body="$t('empty_collection_body')" />

  <v-error
    v-else-if="(items.data && items.data.length === 0) && (items.meta && items.meta.total_count !== 0)"
    :title="$t('no_results')"
    :body="$t('no_results_body')"
    icon="search" />

  <v-listing
    v-else-if="fields.data && items.data"
    :fields="fields.data"
    :items="items.data"
    :view-type="viewType"
    :view-query="viewQuery"
    :view-options="viewOptions"
    :selection="selection"
    :loading="items.loading"
    :lazy-loading="items.lazyLoading"
    :link="links ? '__link__' : null"
    @select="$emit('select', $event)"
    @query="$emit('query', $event)"
    @options="$emit('options', $event)"
    @next-page="lazyLoad" />
</template>

<script>
import formatFilters from "../../helpers/format-filters";

export default {
  name: "v-item-listing",
  props: {
    collection: {
      type: String,
      required: true
    },
    filters: {
      type: Array,
      default: () => []
    },
    searchQuery: {
      type: String,
      default: ""
    },
    viewType: {
      type: String,
      default: "tabular"
    },
    viewOptions: {
      type: Object,
      default: () => ({})
    },
    viewQuery: {
      type: Object,
      default: () => ({})
    },
    selection: {
      type: Array,
      default: null
    },
    links: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      fields: {
        data: null,
        loading: false,
        error: null
      },
      items: {
        meta: null,
        data: null,
        loading: false,
        error: null,

        page: 0,
        lazyLoading: false
      }
    };
  },
  computed: {
    primaryKeyField() {
      if (!this.fields.data) return null;
      return this.$lodash.find(this.fields.data, { interface: "primary-key" })
        .field;
    }
  },
  created() {
    this.hydrate();
  },
  watch: {
    collection() {
      this.hydrate();
    },
    viewQuery: {
      deep: true,
      handler() {
        this.getItems();
      }
    }
  },
  methods: {
    hydrate() {
      this.fields.data = null;
      this.fields.loading = false;
      this.fields.error = null;
      this.items.data = null;
      this.items.loading = false;
      this.items.error = null;

      this.getFields().then(() => this.getItems());
    },
    getFields() {
      this.fields.loading = true;
      this.fields.error = null;

      return this.$api
        .getFields(this.collection)
        .then(res => res.data)
        .then(fields => {
          this.fields.loading = false;

          const fieldsObject = this.$lodash.keyBy(fields, "field");
          this.fields.data = this.$lodash.mapValues(fieldsObject, field => ({
            ...field,
            name: this.$helpers.formatTitle(field.field)
          }));
        })
        .catch(error => {
          this.fields.loading = false;
          this.fields.error = error;
        });
    },
    getItems() {
      this.items.loading = true;
      this.items.error = null;
      this.items.page = 0;

      return this.$api
        .getItems(this.collection, this.formatParams())
        .then(res => {
          this.items.loading = false;
          this.items.meta = res.meta;

          if (this.links) {
            this.items.data = res.data.map(item => ({
              ...item,
              __link__: `/collections/${this.collection}/${
                item[this.primaryKeyField]
              }`
            }));
          } else {
            this.items.data = res.data;
          }

          this.$emit("fetch", res.meta);
        })
        .catch(error => {
          this.items.loading = false;
          this.items.error = error;
        });
    },
    lazyLoad() {
      if (this.items.lazyLoading) return;

      this.items.lazyLoading = true;
      this.items.error = null;

      this.items.page = this.items.page + 1;

      return this.$api
        .getItems(this.collection, this.formatParams())
        .then(res => {
          this.items.lazyLoading = false;

          if (this.links) {
            this.items.data = [
              ...this.items.data,
              ...res.data.map(item => ({
                ...item,
                __link__: `/collections/${this.collection}/${
                  item[this.primaryKeyField]
                }`
              }))
            ];
          } else {
            this.items.data = [...this.items.data, ...res.data];
          }

          this.$emit("fetch", res.meta);
        })
        .catch(error => {
          this.items.lazyLoading = false;
          this.items.error = error;
        });
    },
    formatParams() {
      let params = {
        fields: "*.*",
        meta: "total_count",
        limit: 50,
        offset: 50 * this.items.page
      };

      Object.assign(params, this.viewQuery);

      if (this.searchQuery) {
        params.q = this.searchQuery;
      }

      if (this.filters && this.filters.length > 0) {
        params = {
          ...params,
          ...formatFilters(this.filters)
        };
      }

      if (params.fields) {
        // Make sure all selected fields are retrieved one level deep (to be able to show relational
        //  items)
        params.fields = params.fields
          .split(",")
          .map(field => (field.endsWith(".*") ? field : `${field}.*`));

        // Make sure the primaryKey is always fetched
        if (params.fields.includes(this.primaryKeyField) === false) {
          params.fields.push(this.primaryKeyField);
        }
      }

      return params;
    }
  }
};
</script>
