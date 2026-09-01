import { defineNuxtModule, addServerScanDir } from '@nuxt/kit'
import { resolve } from 'node:path'

export default defineNuxtModule({
  meta: {
    name: 'tawasul-session',
    configKey: 'tawasulSession',
  },
  setup(_options, nuxt) {
    addServerScanDir(resolve(nuxt.options.srcDir, 'modules/session/server'))
  },
})