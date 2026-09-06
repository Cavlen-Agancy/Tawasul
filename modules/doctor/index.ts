import { defineNuxtModule, addServerScanDir, addLayout } from '@nuxt/kit'
import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'

export default defineNuxtModule({
  meta: {
    name: 'tawasul-doctor',
    configKey: 'tawasulDoctor',
  },
  setup(_options, nuxt) {
    addServerScanDir(resolve(nuxt.options.srcDir, 'modules/doctor/server'))

    const layoutSrc = resolve(nuxt.options.srcDir, 'modules/doctor/layouts/DoctorLayout.vue')
    addLayout(
      {
        getContents: () => readFileSync(layoutSrc, 'utf8'),
        filename: 'DoctorLayout.vue',
      },
      'DoctorLayout',
    )
  },
})
