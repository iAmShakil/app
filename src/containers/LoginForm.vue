<template>
  <form
    class="login-form"
    @submit.prevent="login">

    <div v-if="apiUrls.length === 0">
      <invisible-label html-for="url">{{ $t('api_url') }}</invisible-label>
      <v-input
        id="url"
        v-model="url"
        :placeholder="$t('api_url')"
        icon-left="cloud"
        type="url"
        name="url"
        class="input" />
    </div>

    <div>
      <v-select
        v-if="(apiUrls.length === 1 && allowOther === true) || apiUrls.length > 1"
        id="url"
        v-model="url"
        :placeholder="$t('api_url')"
        :other="allowOther"
        :options="apiConfig"
        :custom="allowOther"
        icon="cloud"
        class="input"
        type="url" />
    </div>

    <invisible-label html-for="email">{{ $t('email_address') }}</invisible-label>
    <v-input
      id="email"
      v-model="email"
      :placeholder="$t('email')"
      :disabled="exists !== true"
      icon-left="person"
      class="input"
      type="email"
      name="email" />

    <invisible-label html-for="password">{{ $t('password') }}</invisible-label>
    <v-input
      id="password"
      v-model="password"
      :placeholder="$t('password')"
      :disabled="exists !== true"
      icon-left="lock"
      type="password"
      name="password"
      class="input" />

    <v-button
      :fullwidth="true"
      :disabled="disabled"
      :loading="loading"
      type="submit">{{ $t('login') }}</v-button>
  </form>
</template>

<script>
export default {
  name: 'login-form',
  data() {
    return {
      loading: false,
      exists: null,
      checkingExistence: false,
      thirdPartyAuthProviders: null,
      gettingThirdPartyAuthProviders: false,

      email: '',
      password: '',
      url: Object.keys(window.__DirectusConfig__.api)[0] || '', // eslint-disable-line
    };
  },
  computed: {
    disabled() {
      return !(this.email.length && this.password.length && this.url.length);
    },
    apiConfig() {
      return window.__DirectusConfig__.api; // eslint-disable-line
    },
    apiUrls() {
      return Object.values(this.apiConfig);
    },
    allowOther() {
      return window.__DirectusConfig__.allowOtherAPI; // eslint-disable-line
    },
  },
  watch: {
    url() {
      this.exists = null;
      this.checkUrl();
    },
    exists(newVal, oldVal) {
      if (newVal === true && newVal !== oldVal) {
        this.getThirdPartyAuthProviders();
      }
    },
  },
  created() {
    this.checkUrl = this.$lodash.debounce(this.checkUrl, 300);

    if (this.url) {
      this.checkUrl();
    }
  },
  methods: {
    login() {
      const { email, password, url } = this;
      const credentials = { email, password, url };

      this.loading = true;
      this.$store.dispatch('login', credentials)
        .then(() => {
          this.$emit('login');
        })
        .then(() => {
          if (this.$route.params.redirect) {
            this.$router.push(this.$route.params.redirect);
          }
        })
        .then(() => this.$api.getMe({ fields: 'last_page' }))
        .then(res => res.data.last_page)
        .then((lastPage) => {
          this.loading = false;
          this.$router.push(lastPage || '/');
        })
        .catch((err) => {
          this.loading = false;
          console.error(err); // eslint-disable-line no-console
          this.$router.push('/');
        });
    },
    checkUrl() {
      if (!this.url) return;

      this.checkingExistence = true;

      this.$api.url = this.url;
      this.$api.ping()
        .then(() => {
          this.exists = true;
        })
        .catch(() => {
          this.exists = false;
        })
        .finally(() => {
          this.$api.url = null;
          this.checkingExistence = false;
        });
    },
    getThirdPartyAuthProviders() {
      this.gettingThirdPartyAuthProviders = true;

      this.$api.getThirdPartyAuthProviders()
        .then(res => res.data)
        .then((thirdPartyAuthProviders) => {
          this.thirdPartyAuthProviders = thirdPartyAuthProviders;
        })
        .catch(console.error)
        .finally(() => {
          this.gettingThirdPartyAuthProviders = false;
        });
    },
  },
};
</script>

<style scoped>
.input {
  margin-bottom: 13px;
}
</style>
