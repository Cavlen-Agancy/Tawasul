import { defineNuxtModule, addServerScanDir } from '@nuxt/kit'
import { resolve } from 'node:path'

export default defineNuxtModule({
  meta: {
    name: 'tawasul-payment',
    configKey: 'tawasulPayment',
  },
  setup(_options, nuxt) {
    addServerScanDir(resolve(nuxt.options.srcDir, 'modules/payment/server'))
  },
})