import Vue from "vue";
import Router from "vue-router";
import api from "./api";
import store from "./store";
import { i18n } from "./lang/";
import EventBus from "./events/";
import hydrateStore from "./hydrate";
import Collections from "./routes/collections.vue";
import ItemListing from "./routes/item-listing.vue";
import FileLibrary from "./routes/file-library.vue";
import Edit from "./routes/edit.vue";
import Login from "./routes/login.vue";
import NotFound from "./routes/not-found.vue";
import Interfaces from "./routes/interfaces.vue";
import InterfaceDebugger from "./routes/interface-debugger.vue";
import Debug from "./routes/debug.vue";
import Settings from "./routes/settings/settings.vue";
import SettingsGlobal from "./routes/settings/global.vue";
import SettingsCollections from "./routes/settings/collections.vue";
import SettingsFields from "./routes/settings/fields.vue";
import SettingsRoles from "./routes/settings/roles.vue";
import SettingsPermissions from "./routes/settings/permissions.vue";

import ModalDebug from "./routes/modal-debug.vue";

Vue.use(Router);

const { routerMode } = window.__DirectusConfig__;

const router = new Router({
  mode: routerMode || "history",
  routes: [
    {
      path: "/modals",
      component: ModalDebug
    },
    {
      path: "/",
      redirect: "/collections"
    },
    {
      path: "/collections",
      component: Collections
    },
    {
      path: "/collections/:collection",
      props: true,
      component: ItemListing
    },
    {
      path: "/collections/:collection/:primaryKey",
      props: true,
      component: Edit
    },
    {
      path: "/bookmarks/:collection/:bookmarkID",
      beforeEnter(to, from, next) {
        const { collection, bookmarkID } = to.params;

        const bookmark = store.state.bookmarks.filter(
          bookmark => bookmark.id == bookmarkID
        )[0];

        const {
          search_query,
          filters,
          view_query,
          view_options,
          view_type
        } = bookmark;

        api
          .getItems("directus_collection_presets", {
            "filter[user][eq]": store.state.currentUser.id,
            "filter[title][null]": 1,
            "filter[collection][eq]": collection,
            fields: "id"
          })
          .then(res => res.data)
          .then(data => (data && data.length >= 1 ? data[0] : null))
          .then(userPreferences => {
            if (userPreferences) {
              return api.updateItem(
                "directus_collection_presets",
                userPreferences.id,
                { search_query, filters, view_query, view_options, view_type }
              );
            }
          })
          .then(() => {
            return next({
              /*
              NOTE: This is a hack. The route doesn't update if you navigate from the same route to
                the same route. Therefore, redirecting to just /collections/:collection wouldn't update
                the view if you were already on that page (clicking on a bookmark while being on the
                listing page in question). By adding this param, it forces the update.
                The listing view will remove the query on load so it doesn't clutter the URL too much
               */
              path: `/collections/${collection}?b=${bookmark.id}`
            });
          })
          .catch(error =>
            EventBus.emit("error", {
              notify: i18n.t("something_went_wrong_body"),
              error
            })
          );
      }
    },
    {
      path: "/collections/directus_files",
      redirect: "/files"
    },
    {
      path: "/files",
      component: FileLibrary
    },
    {
      path: "/collections/directus_files/:primaryKey",
      component: Edit,
      alias: "/files/:primaryKey"
    },
    {
      path: "/collections/directus_users",
      component: ItemListing,
      alias: "/users"
    },
    {
      path: "/collections/directus_users/:primaryKey",
      component: Edit,
      alias: "/users/:primaryKey"
    },
    {
      path: "/collections/directus_activity",
      component: ItemListing,
      alias: "/activity"
    },
    {
      path: "/debug",
      component: Debug
    },
    {
      path: "/settings",
      component: Settings
    },
    {
      path: "/settings/global",
      component: SettingsGlobal
    },
    {
      path: "/settings/collections",
      component: SettingsCollections
    },
    {
      path: "/settings/collections/:collection",
      component: SettingsFields,
      props: true
    },
    {
      path: "/settings/roles",
      component: SettingsRoles
    },
    {
      path: "/settings/roles/:id",
      component: SettingsPermissions,
      props: true
    },
    {
      path: "/interfaces",
      component: Interfaces
    },
    {
      path: "/interfaces/:id",
      component: InterfaceDebugger,
      props: true
    },
    {
      path: "/login",
      component: Login,
      meta: {
        publicRoute: true
      },
      beforeEnter(to, from, next) {
        if (api.loggedIn) return next(false);
        return next();
      }
    },
    {
      path: "/logout",
      beforeEnter(to, from, next) {
        store.dispatch("logout");
        next("/login");
      }
      // redirect: '/login',
    },
    {
      path: "*",
      component: NotFound
    }
  ]
});

router.beforeEach((to, from, next) => {
  const { loggedIn } = store.getters;
  const publicRoute = to.matched.some(record => record.meta.publicRoute);

  if (loggedIn === false) {
    if (publicRoute) {
      return next();
    }

    if (from.fullPath === "/") {
      return next({ path: "/login" });
    }

    return next({
      path: "/login",
      query: { redirect: to.fullPath }
    });
  }

  // NOTE: This is first load
  if (store.state.hydrated === false) {
    return hydrateStore().then(() => {
      if (store.getters.editing) {
        const { collection, primaryKey } = store.state.edits;
        return next(`/collections/${collection}/${primaryKey}`);
      }
      return next();
    });
  }

  return next();
});

router.afterEach((to, from) => {
  if (store.state.hydrating === false && from.path !== "/logout") {
    store.dispatch("track", { page: to.path });
  }
});

export default router;
