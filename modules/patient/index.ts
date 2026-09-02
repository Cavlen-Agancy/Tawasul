import { defineNuxtModule, addServerScanDir, addLayout } from '@nuxt/kit'
import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'

export default defineNuxtModule({
  meta: {
    name: 'tawasul-patient',
    configKey: 'tawasulPatient',
  },
  setup(_options, nuxt) {
    addServerScanDir(resolve(nuxt.options.srcDir, 'modules/patient/server'))

    const layoutSrc = resolve(nuxt.options.srcDir, 'modules/patient/layouts/PatientLayout.vue')
    addLayout(
      {
        getContents: () => readFileSync(layoutSrc, 'utf8'),
        filename: 'PatientLayout.vue',
      },
      'PatientLayout',
    )
  },
})
