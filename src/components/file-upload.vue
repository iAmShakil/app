<template>
  <portal to="modal">
    <v-modal
      :title="$t('file_upload')"
      :buttons="{
        upload: {
          text: $t('upload')
        }
      }">
      <form enctype="multipart/form-data" novalidate>
        <input
          type="file"
          multiple
          :name="uploadFieldName"
          :disabled="isSaving"
          accept="image/*"
          class="input-file"
          @change="">
          // https://serversideup.net/uploading-files-vuejs-axios/
      </form>
    </v-modal>
  </portal>
</template>

<script>
export default {
  name: "file-upload"
};
</script>
