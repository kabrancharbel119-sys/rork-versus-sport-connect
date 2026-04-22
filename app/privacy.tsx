import React from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { safeBack } from '@/lib/navigation';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useI18n } from '@/contexts/I18nContext';

const PRIVACY_CONTENT = {
  fr: {
    lastUpdated: 'Dernière mise à jour : 23 janvier 2026',
    intro: 'VS (Versus) s\'engage à protéger votre vie privée. Cette politique explique comment nous collectons, utilisons et protégeons vos données personnelles.',
    sections: [
      { title: '1. Données collectées', subtitle: 'Informations fournies par l\'utilisateur :', text: '• Nom, prénom, nom d\'utilisateur\n• Adresse email et numéro de téléphone\n• Photo de profil\n• Ville et pays de résidence\n• Informations sportives (sports pratiqués, niveau, position)\n• Disponibilités' },
      { subtitle: 'Informations collectées automatiquement :', text: '• Données de localisation (avec votre consentement)\n• Statistiques d\'utilisation de l\'application\n• Informations sur l\'appareil\n• Historique des matchs et performances' },
      { title: '2. Utilisation des données', text: 'Nous utilisons vos données pour :\n• Créer et gérer votre compte\n• Faciliter la création d\'équipes et de matchs\n• Gérer les demandes à rejoindre les équipes (notifications aux capitaines et co-capitaines)\n• Vérifier l’éligibilité à la création de tournois (capitaine d’équipe d’au moins 5 membres) et aux inscriptions (capitaine uniquement)\n• Calculer vos statistiques et réputation\n• Vous connecter avec d\'autres joueurs dans votre zone\n• Envoyer des notifications pertinentes (annonces, demandes d’équipe, etc.)\n• Améliorer nos services\n• Prévenir la fraude et assurer la sécurité' },
      { title: '3. Partage des données', text: 'Vos données peuvent être partagées avec :\n• Les autres utilisateurs (profil public)\n• Les membres de vos équipes\n• Les organisateurs de tournois\n• Nos partenaires terrains (pour les réservations)\n• Les autorités si requis par la loi\n\nNous ne vendons jamais vos données personnelles à des tiers.' },
      { title: '4. Données de localisation', text: 'La localisation est utilisée pour :\n• Trouver des matchs et joueurs proches\n• Afficher les terrains disponibles\n• Calculer les distances pour les matchs\n\nVous pouvez désactiver la localisation dans les paramètres, mais certaines fonctionnalités seront limitées.' },
      { title: '5. Sécurité des données', text: 'Nous protégeons vos données par :\n• Chiffrement des données sensibles\n• Stockage sécurisé\n• Accès restreint aux employés autorisés\n• Surveillance des activités suspectes' },
      { title: '6. Conservation des données', text: 'Vos données sont conservées tant que votre compte est actif. Après suppression du compte, certaines données peuvent être conservées pour des raisons légales ou de sécurité pendant une période limitée.' },
      { title: '7. Vos droits', text: 'Vous avez le droit de :\n• Accéder à vos données personnelles\n• Corriger des informations inexactes\n• Demander la suppression de vos données\n• Retirer votre consentement\n• Exporter vos données\n\nPour exercer ces droits, contactez-nous via l\'application.' },
      { title: '8. Suppression de compte et données', text: 'Vous pouvez demander la suppression de votre compte et de toutes les données associées à tout moment.\n\nPour demander la suppression :\n• Via l\'application : Réglages → Compte → Supprimer mon compte\n• Par email : privacy@versus.com avec l\'objet "Demande de suppression de compte"\n\nAprès validation de votre demande :\n• Votre compte sera désactivé immédiatement\n• Vos données personnelles seront supprimées sous 30 jours\n• Certaines données peuvent être conservées pour obligations légales (historique de transactions, etc.)\n\nCette action est irréversible.' },
      { title: '9. Cookies et technologies similaires', text: 'Nous utilisons des technologies de suivi pour améliorer votre expérience et analyser l\'utilisation de l\'application. Vous pouvez gérer ces préférences dans les paramètres.' },
      { title: '10. Mineurs', text: 'VS est destiné aux utilisateurs de 16 ans et plus. Nous ne collectons pas sciemment de données sur les enfants de moins de 16 ans.' },
      { title: '11. Modifications', text: 'Cette politique peut être mise à jour. Les modifications importantes vous seront notifiées par email ou via l\'application.' },
      { title: '12. Contact', text: 'Pour toute question concernant vos données personnelles :\n\nEmail : privacy@versus.com\nVia l\'application : Réglages → Nous contacter' },
    ],
  },
  en: {
    lastUpdated: 'Last updated: January 23, 2026',
    intro: 'VS (Versus) is committed to protecting your privacy. This policy explains how we collect, use, and protect your personal data.',
    sections: [
      { title: '1. Collected data', subtitle: 'Information provided by the user:', text: '• First and last name, username\n• Email address and phone number\n• Profile picture\n• City and country of residence\n• Sports information (sports played, level, position)\n• Availability' },
      { subtitle: 'Information collected automatically:', text: '• Location data (with your consent)\n• App usage statistics\n• Device information\n• Match and performance history' },
      { title: '2. How we use data', text: 'We use your data to:\n• Create and manage your account\n• Facilitate team and match creation\n• Manage team join requests (notifications to captains and co-captains)\n• Verify eligibility for tournament creation (captain of at least a 5-member team) and registration (captain only)\n• Calculate your stats and reputation\n• Connect you with nearby players\n• Send relevant notifications (announcements, team requests, etc.)\n• Improve our services\n• Prevent fraud and ensure security' },
      { title: '3. Data sharing', text: 'Your data may be shared with:\n• Other users (public profile)\n• Members of your teams\n• Tournament organizers\n• Venue partners (for bookings)\n• Authorities when required by law\n\nWe never sell your personal data to third parties.' },
      { title: '4. Location data', text: 'Location is used to:\n• Find nearby matches and players\n• Display available venues\n• Calculate distances for matches\n\nYou can disable location in settings, but some features will be limited.' },
      { title: '5. Data security', text: 'We protect your data through:\n• Encryption of sensitive data\n• Secure storage\n• Restricted access for authorized staff\n• Monitoring suspicious activity' },
      { title: '6. Data retention', text: 'Your data is kept while your account is active. After account deletion, some data may be retained for legal or security reasons for a limited period.' },
      { title: '7. Your rights', text: 'You have the right to:\n• Access your personal data\n• Correct inaccurate information\n• Request data deletion\n• Withdraw your consent\n• Export your data\n\nTo exercise these rights, contact us through the app.' },
      { title: '8. Account and data deletion', text: 'You can request deletion of your account and all associated data at any time.\n\nTo request deletion:\n• In-app: Settings → Account → Delete my account\n• By email: privacy@versus.com with subject "Account deletion request"\n\nAfter validation:\n• Your account will be deactivated immediately\n• Your personal data will be deleted within 30 days\n• Some data may be retained for legal obligations (transaction history, etc.)\n\nThis action is irreversible.' },
      { title: '9. Cookies and similar technologies', text: 'We use tracking technologies to improve your experience and analyze app usage. You can manage these preferences in settings.' },
      { title: '10. Minors', text: 'VS is intended for users aged 16 and above. We do not knowingly collect data from children under 16.' },
      { title: '11. Changes', text: 'This policy may be updated. Important changes will be notified by email or in-app.' },
      { title: '12. Contact', text: 'For any question regarding your personal data:\n\nEmail: privacy@versus.com\nIn-app: Settings → Contact us' },
    ],
  },
};

export default function PrivacyScreen() {
  const router = useRouter();
  const { locale, t } = useI18n();
  const content = locale === 'en' ? PRIVACY_CONTENT.en : PRIVACY_CONTENT.fr;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <LinearGradient colors={[Colors.background.dark, '#0D1420']} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => safeBack(router, '/(tabs)/(home)')}><ArrowLeft size={24} color={Colors.text.primary} /></TouchableOpacity>
            <Text style={styles.headerTitle}>{t('settings.privacyPolicy')}</Text>
            <View style={styles.placeholder} />
          </View>
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.lastUpdated}>{content.lastUpdated}</Text>
            <Text style={styles.intro}>{content.intro}</Text>
            {content.sections.map((section, index) => (
              <React.Fragment key={`${section.title ?? 'section'}-${index}`}>
                {section.title && <Text style={styles.sectionTitle}>{section.title}</Text>}
                {section.subtitle && <Text style={styles.subtitle}>{section.subtitle}</Text>}
                <Text style={styles.text}>{section.text}</Text>
              </React.Fragment>
            ))}

            <View style={styles.bottomSpacer} />
          </ScrollView>
        </SafeAreaView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.background.card, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: Colors.text.primary, fontSize: 18, fontWeight: '600' as const },
  placeholder: { width: 40 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  lastUpdated: { color: Colors.text.muted, fontSize: 13, marginBottom: 16 },
  intro: { color: Colors.text.secondary, fontSize: 14, lineHeight: 22, marginBottom: 8 },
  sectionTitle: { color: Colors.text.primary, fontSize: 16, fontWeight: '600' as const, marginTop: 24, marginBottom: 12 },
  subtitle: { color: Colors.primary.blue, fontSize: 14, fontWeight: '500' as const, marginTop: 12, marginBottom: 8 },
  text: { color: Colors.text.secondary, fontSize: 14, lineHeight: 22 },
  bottomSpacer: { height: 40 },
});
