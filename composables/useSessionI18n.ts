import { ref, computed } from 'vue'

export type SessionLocale = 'en' | 'ar'

export const currentLocale = ref<SessionLocale>('en')

export const translations = {
  en: {
    // Waiting Room
    'session.waitingRoom.brand': 'Tawasul Academy',
    'session.waitingRoom.subBrand': 'Online Mental & Behavioral Health Clinic',
    'session.waitingRoom.badge': 'Virtual Waiting Room',
    'session.waitingRoom.leaveBtn': 'Leave Room',
    'session.waitingRoom.cameraPreview': 'Camera Preview',
    'session.waitingRoom.cameraOffTitle': 'Camera is turned off',
    'session.waitingRoom.cameraOffDesc': 'Turn on your camera to check your lighting and video before joining the call.',
    'session.waitingRoom.cameraActive': 'Camera Preview Active',
    'session.waitingRoom.cameraOff': 'Camera Off',
    'session.waitingRoom.micReady': 'Microphone Ready',
    'session.waitingRoom.micMuted': 'Microphone Muted',
    'session.waitingRoom.micOnLabel': 'Microphone: ON',
    'session.waitingRoom.micOffLabel': 'Microphone: Muted',
    'session.waitingRoom.camOnLabel': 'Camera: ON',
    'session.waitingRoom.camOffLabel': 'Camera: OFF',
    'session.waitingRoom.doctorAssigned': 'Assigned Doctor',
    'session.waitingRoom.doctorPresentTitle': 'Doctor is in the session',
    'session.waitingRoom.waitingForApproval': 'Waiting for the doctor to admit you to the session...',
    'session.waitingRoom.autoJoinNote': 'You will automatically join the video call as soon as the doctor admits you.',
    'session.waitingRoom.waitingForDoctorTitle': 'You are in the waiting room',
    'session.waitingRoom.waitingForDoctorDesc': 'Waiting for the doctor to enter the room...',
    'session.waitingRoom.serverConnected': 'Server connection active and ready',
    'session.waitingRoom.tipsTitle': 'Tips for a comfortable session:',
    'session.waitingRoom.tipHeadphones': 'Use headphones or earphones for optimal audio clarity and privacy.',
    'session.waitingRoom.tipLighting': 'Sit in a quiet, well-lit room facing the camera.',
    'session.waitingRoom.tipPrivacy': 'This session is private, encrypted, and strictly confidential.',

    // Active Session
    'session.active.live': 'LIVE',
    'session.active.service': 'Medical Consultation',
    'session.active.encrypted': 'Encrypted & Secure',
    'session.active.remoteCamOff': 'Camera is turned off by the other party',
    'session.active.waitingForRemote': 'Waiting for the other participant to join the session...',
    'session.active.waitingForRemoteDesc': 'The call will connect with video and audio as soon as they join.',
    'session.active.you': 'You',
    'session.active.youDoctor': 'You (Dr.)',
    'session.active.camOffSelf': 'Camera Off',

    // Controls
    'session.controls.micMute': 'Mute microphone',
    'session.controls.micUnmute': 'Unmute microphone',
    'session.controls.camTurnOff': 'Turn camera off',
    'session.controls.camTurnOn': 'Turn camera on',
    'session.controls.speakerMute': 'Mute session audio',
    'session.controls.speakerUnmute': 'Unmute session audio',
    'session.controls.settings': 'Media & Device Settings',
    'session.controls.endCall': 'End Session',
    'session.controls.stayInCall': 'Stay in Session',
    'session.controls.confirmEnd': 'Confirm Leave',

    // Devices
    'session.devices.title': 'Media & Device Settings',
    'session.devices.microphone': 'Microphone',
    'session.devices.speaker': 'Speaker',
    'session.devices.camera': 'Camera',
    'session.devices.defaultMic': 'Default Microphone',
    'session.devices.defaultCam': 'Default Camera',
    'session.devices.defaultSpeaker': 'Default Speaker / Headphones',
    'session.devices.speakerNotSupported': 'Speaker selection is not supported by this browser. Default system output is used.',
    'session.devices.noDevices': 'No devices detected',
    'session.devices.deviceChanged': 'Audio or video devices have been updated.',

    // Doctor Admit
    'session.doctor.waitingBadge': 'In Waiting Room',
    'session.doctor.admitBtn': 'Admit Patient',
    'session.doctor.admitting': 'Admitting...',
    'session.doctor.admitError': 'Failed to admit patient. Please try again.',
    'session.doctor.waitingPatient': 'Patient is waiting in the waiting room',

    // Modals
    'session.modal.leaveTitle': 'Are you sure you want to leave?',
    'session.modal.leaveDoctorTitle': 'End session and leave call?',
    'session.modal.leaveDesc': 'Leaving will disconnect the session and return you to your appointments.',
    'session.modal.leaveDoctorDesc': 'Leaving will disconnect the session and return you to your calendar.',

    // Media & Permissions Errors
    'session.media.micDenied': 'Microphone access was denied. Please allow microphone permissions in your browser settings.',
    'session.media.camDenied': 'Camera access was denied. Please allow camera permissions in your browser settings.',
    'session.media.noMic': 'No microphone was found on your device.',
    'session.media.noCam': 'No camera was found on your device.',
    'session.media.micBusy': 'Unable to access microphone. It may be in use by another application.',
    'session.media.camBusy': 'Unable to access camera. It may be in use by another application.',
    'session.media.overconstrained': 'The requested device settings are not supported by your hardware.',
    'session.media.unauthorized': 'You do not have permission to publish audio or video.',
    'session.media.genericMic': 'Unable to enable microphone. Please try again.',
    'session.media.genericCam': 'Unable to enable camera. Please try again.',
    'session.media.alertTitle': 'Media Device Notice',

    // General Session States
    'session.state.startsSoonTitle': 'Your session starts soon',
    'session.state.startsSoonDesc': 'The session room opens 5 minutes before the scheduled time. Please return then to join.',
    'session.state.backToAppointments': 'Back to Appointments',
    'session.state.backToCalendar': 'Back to Calendar',
    'session.state.loadErrorTitle': 'Unable to load session',
    'session.state.retry': 'Try Again',
    'session.state.connectError': 'Failed to connect to the session server. Please check your internet connection.',

    // Loading Stages
    'session.loading.fetchingToken': 'Preparing session details...',
    'session.loading.connecting': 'Connecting to session room...',
    'session.loading.initMedia': 'Checking camera and microphone...',
    'session.loading.timeout': 'Connection timed out. Please check your network and try again.',
  },
  ar: {
    // Waiting Room
    'session.waitingRoom.brand': 'تواصل أكاديمي',
    'session.waitingRoom.subBrand': 'عيادة الاستشارات النفسية والصحية',
    'session.waitingRoom.badge': 'غرفة الانتظار الافتراضية',
    'session.waitingRoom.leaveBtn': 'مغادرة الغرفة',
    'session.waitingRoom.cameraPreview': 'معاينة الكاميرا',
    'session.waitingRoom.cameraOffTitle': 'الكاميرا متوقفة حاليًا',
    'session.waitingRoom.cameraOffDesc': 'يمكنك تفعيل الكاميرا للتحقق من مظهرك وإضاءتك قبل بدء الجلسة.',
    'session.waitingRoom.cameraActive': 'معاينة الكاميرا نشطة',
    'session.waitingRoom.cameraOff': 'الكاميرا مغلقة',
    'session.waitingRoom.micReady': 'الميكروفون جاهز',
    'session.waitingRoom.micMuted': 'الميكروفون مكتوم',
    'session.waitingRoom.micOnLabel': 'الميكروفون: شغال',
    'session.waitingRoom.micOffLabel': 'الميكروفون: مكتوم',
    'session.waitingRoom.camOnLabel': 'الكاميرا: شغالة',
    'session.waitingRoom.camOffLabel': 'الكاميرا: متوقفة',
    'session.waitingRoom.doctorAssigned': 'الطبيب المعالج',
    'session.waitingRoom.doctorPresentTitle': 'الطبيب متواجد حالياً في الجلسة',
    'session.waitingRoom.waitingForApproval': 'بانتظار موافقة الطبيب للانضمام إلى الجلسة...',
    'session.waitingRoom.autoJoinNote': 'ستنتقل للشاشة الرئيسية للمكالمة تلقائياً بمجرد قبول الطبيب.',
    'session.waitingRoom.waitingForDoctorTitle': 'أنت الآن في غرفة الانتظار',
    'session.waitingRoom.waitingForDoctorDesc': 'في انتظار دخول الطبيب إلى الغرفة...',
    'session.waitingRoom.serverConnected': 'الاتصال بالخادم نشط وجاهز',
    'session.waitingRoom.tipsTitle': 'إرشادات لجلسة مريحة:',
    'session.waitingRoom.tipHeadphones': 'استخدم سماعات الرأس للحصول على أفضل وضوح للصوت وخصوصية تامة.',
    'session.waitingRoom.tipLighting': 'تأكد من الجلوس في مكان هادئ ذي إضاءة مناسبة أمام الكاميرا.',
    'session.waitingRoom.tipPrivacy': 'الجلسة مشفرة ومحمية بأعلى معايير الخصوصية الطبية.',

    // Active Session
    'session.active.live': 'مباشر',
    'session.active.service': 'استشارة طبية',
    'session.active.encrypted': 'مشفرة وآمنة',
    'session.active.remoteCamOff': 'الكاميرا مغلقة من قِبل الطرف الآخر',
    'session.active.waitingForRemote': 'في انتظار انضمام الطرف الآخر للجلسة...',
    'session.active.waitingForRemoteDesc': 'ستبدأ المكالمة بالصوت والصورة فور اتصاله.',
    'session.active.you': 'أنت',
    'session.active.youDoctor': 'أنت (د.)',
    'session.active.camOffSelf': 'الكاميرا متوقفة',

    // Controls
    'session.controls.micMute': 'كتم الميكروفون',
    'session.controls.micUnmute': 'تشغيل الميكروفون',
    'session.controls.camTurnOff': 'إيقاف الكاميرا',
    'session.controls.camTurnOn': 'تشغيل الكاميرا',
    'session.controls.speakerMute': 'كتم صوت الجلسة',
    'session.controls.speakerUnmute': 'تشغيل صوت الجلسة',
    'session.controls.settings': 'إعدادات الأجهزة والوسائط',
    'session.controls.endCall': 'إنهاء الجلسة',
    'session.controls.stayInCall': 'البقاء في الجلسة',
    'session.controls.confirmEnd': 'تأكيد المغادرة',

    // Devices
    'session.devices.title': 'إعدادات الأجهزة والوسائط',
    'session.devices.microphone': 'الميكروفون',
    'session.devices.speaker': 'السماعة',
    'session.devices.camera': 'الكاميرا',
    'session.devices.defaultMic': 'الميكروفون الافتراضي',
    'session.devices.defaultCam': 'الكاميرا الافتراضية',
    'session.devices.defaultSpeaker': 'السماعة الافتراضية',
    'session.devices.speakerNotSupported': 'تغيير مخرج الصوت غير مدعوم في هذا المتصفح. يتم استخدام مخرج النظام.',
    'session.devices.noDevices': 'لم يتم العثور على أجهزة',
    'session.devices.deviceChanged': 'تم تحديث قائمة أجهزة الصوت والفيديو المتصلة.',

    // Doctor Admit
    'session.doctor.waitingBadge': 'في غرفة الانتظار',
    'session.doctor.admitBtn': 'قبول المريض',
    'session.doctor.admitting': 'جاري القبول...',
    'session.doctor.admitError': 'تعذر قبول المريض. حاول مرة أخرى.',
    'session.doctor.waitingPatient': 'المريض ينتظر في غرفة الانتظار',

    // Modals
    'session.modal.leaveTitle': 'هل أنت متأكد من رغبتك في المغادرة؟',
    'session.modal.leaveDoctorTitle': 'هل تريد إنهاء الجلسة والمغادرة؟',
    'session.modal.leaveDesc': 'عند المغادرة سيتم قطع اتصال الجلسة والعودة إلى قائمة مواعيدك.',
    'session.modal.leaveDoctorDesc': 'سيتم قطع اتصال المكالمة والعودة إلى جدول المواعيد الخاص بك.',

    // Media & Permissions Errors
    'session.media.micDenied': 'لم نتمكن من تشغيل الميكروفون. تأكد من السماح للمتصفح باستخدام الميكروفون من إعدادات الموقع.',
    'session.media.camDenied': 'لم نتمكن من تشغيل الكاميرا. تأكد من السماح للمتصفح باستخدام الكاميرا من إعدادات الموقع.',
    'session.media.noMic': 'لم يتم العثور على ميكروفون متصل بجهازك.',
    'session.media.noCam': 'لم يتم العثور على كاميرا متصلة بجهازك.',
    'session.media.micBusy': 'تعذر تشغيل الميكروفون. تأكد من أن الميكروفون ليس مستخدمًا بواسطة تطبيق آخر.',
    'session.media.camBusy': 'تعذر تشغيل الكاميرا. تأكد من أن الكاميرا ليست مستخدمة بواسطة تطبيق آخر.',
    'session.media.overconstrained': 'إعدادات الكاميرا أو الميكروفون المطلوبة غير مدعومة بجهازك.',
    'session.media.unauthorized': 'ليس لديك صلاحية لنشر الفيديو أو الصوت حالياً.',
    'session.media.genericMic': 'تعذر تفعيل الميكروفون. يرجى إعادة المحاولة.',
    'session.media.genericCam': 'تعذر تفعيل الكاميرا. يرجى إعادة المحاولة.',
    'session.media.alertTitle': 'تنبيه بالوسائط',

    // General Session States
    'session.state.startsSoonTitle': 'تبدأ الجلسة قريباً',
    'session.state.startsSoonDesc': 'تفتح غرفة الجلسة قبل موعدها المحدد بـ 5 دقائق. يرجى العودة في الوقت المحدد للانضمام.',
    'session.state.backToAppointments': 'العودة للمواعيد',
    'session.state.backToCalendar': 'العودة لجدول المواعيد',
    'session.state.loadErrorTitle': 'تعذر فتح الجلسة',
    'session.state.retry': 'إعادة المحاولة',
    'session.state.connectError': 'تعذر الاتصال بخادم الجلسة. يرجى التحقق من اتصال الإنترنت.',

    // Loading Stages
    'session.loading.fetchingToken': 'جاري إعداد بيانات الجلسة...',
    'session.loading.connecting': 'جاري الاتصال بغرفة الجلسة...',
    'session.loading.initMedia': 'جاري فحص الكاميرا والميكروفون...',
    'session.loading.timeout': 'انتهت مهلة الاتصال. يرجى التحقق من الشبكة وإعادة المحاولة.',
  },
} as const

export type TranslationKey = keyof (typeof translations)['en']

export function useSessionI18n() {
  const locale = currentLocale

  function t(key: TranslationKey | string, params?: Record<string, string>): string {
    const dict = translations[locale.value] as Record<string, string>
    let text = dict[key] || (translations.en as Record<string, string>)[key] || key
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), v)
      })
    }
    return text
  }

  function getMediaErrorMessage(err: unknown, deviceType: 'camera' | 'microphone'): string {
    const name = err instanceof Error ? err.name : String(err)
    const message = (err instanceof Error ? err.message : '').toLowerCase()

    if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || message.includes('denied') || message.includes('permission')) {
      return deviceType === 'camera' ? t('session.media.camDenied') : t('session.media.micDenied')
    }

    if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || message.includes('not found')) {
      return deviceType === 'camera' ? t('session.media.noCam') : t('session.media.noMic')
    }

    if (name === 'NotReadableError' || name === 'TrackStartError' || message.includes('in use') || message.includes('busy')) {
      return deviceType === 'camera' ? t('session.media.camBusy') : t('session.media.micBusy')
    }

    if (name === 'OverconstrainedError') {
      return t('session.media.overconstrained')
    }

    if (message.includes('permission') || message.includes('403')) {
      return t('session.media.unauthorized')
    }

    return deviceType === 'camera' ? t('session.media.genericCam') : t('session.media.genericMic')
  }

  function formatDeviceLabel(device: MediaDeviceInfo, index: number, kind: MediaDeviceKind): string {
    if (device.label && device.label.trim()) {
      return device.label
    }
    if (kind === 'audioinput') {
      return `${t('session.devices.microphone')} ${index + 1}`
    }
    if (kind === 'videoinput') {
      return `${t('session.devices.camera')} ${index + 1}`
    }
    return `${t('session.devices.speaker')} ${index + 1}`
  }

  return {
    locale,
    t,
    getMediaErrorMessage,
    formatDeviceLabel,
  }
}
