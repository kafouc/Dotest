import type { I18nVariables } from '@supabase/auth-ui-shared';

export const authLocalization = {
  variables: {
    sign_in: {
      email_label: 'Adresse email',
      password_label: 'Mot de passe',
      button_label: 'Se connecter',
      link_text: "Vous n'avez pas de compte ? S'inscrire",
      loading_button_label: 'Chargement...'
    },
    sign_up: {
      email_label: 'Adresse email',
      password_label: 'Mot de passe',
      button_label: "S'inscrire",
      link_text: 'Vous avez déjà un compte ? Se connecter',
      loading_button_label: 'Chargement...'
    },
    forgotten_password: {
      email_label: 'Adresse email',
      email_input_placeholder: 'Votre adresse email',
      button_label: 'Envoyer les instructions',
      link_text: 'Retour à la connexion',
      loading_button_label: 'Chargement...'
    },
    magic_link: {
      empty_email_address: 'Veuillez entrer une adresse email'
    }
  }
} as const satisfies { variables?: I18nVariables };

