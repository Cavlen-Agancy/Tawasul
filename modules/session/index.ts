import { defineNuxtModule, addServerScanDir, addLayout } from '@nuxt/kit'
import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'

export default defineNuxtModule({
  meta: {
    name: 'tawasul-session',
    configKey: 'tawasulSession',
  },
  setup(_options, nuxt) {
    addServerScanDir(resolve(nuxt.options.srcDir, 'modules/session/server'))

    const layoutSrc = resolve(nuxt.options.srcDir, 'modules/session/layouts/MeetingLayout.vue')
    addLayout(
      {
        getContents: () => readFileSync(layoutSrc, 'utf8'),
        filename: 'MeetingLayout.vue',
      },
      'MeetingLayout',
    )
  },
})