import type { Dictionary } from './en';

export const es: Dictionary = {
  skipToContent: 'Saltar al contenido',
  header: {
    homeLabel: 'Receipts App, inicio',
  },
  footer: {
    tagline: 'Proyecto de portafolio construido sobre AWS.',
  },
  languageSwitcher: {
    label: 'Idioma',
    options: {
      en: 'English',
      es: 'Español',
    },
  },
  home: {
    title: 'Fotografía el recibo. El gasto se registra solo.',
    description:
      'La IA lee el comercio, el total, la fecha y la categoría de la foto y guarda el gasto por ti. Luego ves en qué se va tu dinero, mes a mes.',
    createAccount: 'Crear cuenta',
    signIn: 'Iniciar sesión',
    preview: {
      heading: 'Datos extraídos',
      status: 'Procesado',
      merchantLabel: 'Comercio',
      dateLabel: 'Fecha',
      categoryLabel: 'Categoría',
      totalLabel: 'Total',
      monthLabel: 'Supermercado este mes:',
      merchant: 'Mercado La Cosecha',
      date: '28 oct 2026',
      category: 'Supermercado',
      currency: 'COP',
      total: 86450,
      monthTotal: 412300,
    },
  },
  notFound: {
    title: 'No encontramos esta página',
    description:
      'Puede que el enlace esté mal escrito o que la página ya no exista. Tus recibos y gastos siguen a salvo.',
    backHome: 'Volver al inicio',
  },
  signUp: {
    title: 'Crear cuenta',
    description: 'Te enviaremos un código a tu correo para confirmarlo.',
    emailLabel: 'Correo',
    passwordLabel: 'Contraseña',
    passwordHint: 'Mínimo 8 caracteres, con mayúscula, minúscula y número.',
    submit: 'Crear cuenta',
    submitting: 'Creando cuenta…',
    haveAccount: '¿Ya tienes cuenta?',
    signInLink: 'Inicia sesión',
  },
  validation: {
    emailInvalid: 'Escribe un correo válido.',
    passwordMinLength: 'Mínimo 8 caracteres.',
    passwordLowercase: 'Incluye al menos una minúscula.',
    passwordUppercase: 'Incluye al menos una mayúscula.',
    passwordNumber: 'Incluye al menos un número.',
  },
  authErrors: {
    usernameExists: 'Ya existe una cuenta con este correo.',
    invalidPassword: 'La contraseña no cumple los requisitos.',
    invalidParameter: 'Revisa los datos e inténtalo de nuevo.',
    codeMismatch: 'El código no es correcto.',
    expiredCode: 'El código expiró. Pide uno nuevo.',
    notAuthorized: 'Correo o contraseña incorrectos.',
    userNotConfirmed: 'Tu correo aún no está confirmado.',
    tooManyAttempts: 'Demasiados intentos. Espera unos minutos.',
    unknown: 'Algo salió mal. Inténtalo de nuevo.',
  },
};
