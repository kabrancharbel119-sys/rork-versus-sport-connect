import React from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useI18n } from '@/contexts/I18nContext';

const TERMS_CONTENT = {
  fr: {
    lastUpdated: 'Dernière mise à jour : 23 janvier 2026',
    sections: [
      { title: '1. Acceptation des conditions', text: 'En téléchargeant, installant ou utilisant l\'application VS (Versus), vous acceptez d\'être lié par les présentes conditions d\'utilisation. Si vous n\'acceptez pas ces conditions, veuillez ne pas utiliser l\'application.' },
      { title: '2. Description du service', text: 'VS est une plateforme mobile permettant aux utilisateurs de :\n• Créer et gérer des équipes sportives\n• Organiser et participer à des matchs\n• Participer à des tournois avec cash prizes\n• Réserver des terrains sportifs\n• Communiquer avec d\'autres joueurs\n• Suivre leurs statistiques et performances' },
      { title: '3. Inscription et compte', text: 'Pour utiliser VS, vous devez créer un compte. Vous vous engagez à :\n• Fournir des informations exactes et à jour\n• Maintenir la confidentialité de vos identifiants\n• Être âgé d\'au moins 16 ans\n• Ne pas créer plusieurs comptes' },
      { title: '4. Comportement des utilisateurs', text: 'En utilisant VS, vous vous engagez à :\n• Respecter les autres utilisateurs\n• Ne pas publier de contenu offensant, discriminatoire ou illégal\n• Ne pas tricher ou manipuler les résultats des matchs\n• Respecter le fair-play sportif\n• Ne pas harceler d\'autres utilisateurs' },
      { title: '5. Équipes et matchs', text: '• Les capitaines d\'équipe sont responsables de la gestion de leur équipe\n• Seul le capitaine (et les co-capitaines) peut accepter ou refuser les demandes de rejoindre l\'équipe\n• Les demandes à rejoindre une équipe sont notifiées au capitaine et aux co-capitaines dans le panneau Notifications\n• Les résultats des matchs doivent être reportés honnêtement\n• Les annulations de dernière minute peuvent affecter votre réputation\n• Le système de réputation est basé sur le comportement et la fiabilité' },
      { title: '6. Tournois et cash prizes', text: '• Seuls les capitaines d\'une équipe d\'au moins 5 membres peuvent créer un tournoi\n• Seul le capitaine d\'une équipe peut inscrire celle-ci à un tournoi ; les membres ne peuvent pas inscrire l\'équipe\n• Les frais d\'inscription aux tournois sont non remboursables sauf annulation par VS\n• Les cash prizes sont distribués selon les règles du tournoi\n• VS prélève une commission sur les transactions\n• Les gains doivent être déclarés selon les lois fiscales locales' },
      { title: '7. Réservation de terrains', text: '• Les réservations sont soumises à disponibilité\n• Les annulations sont soumises aux politiques des terrains\n• VS n\'est pas responsable des problèmes liés aux terrains partenaires' },
      { title: '8. Propriété intellectuelle', text: '• Le contenu de l\'application est protégé par le droit d\'auteur\n• Les utilisateurs conservent la propriété de leur contenu mais accordent à VS une licence d\'utilisation\n• Il est interdit de copier ou reproduire l\'application' },
      { title: '9. Suspension et résiliation', text: 'VS se réserve le droit de :\n• Suspendre ou résilier votre compte en cas de violation\n• Supprimer du contenu inapproprié\n• Modifier ou interrompre le service' },
      { title: '10. Limitation de responsabilité', text: 'VS ne peut être tenu responsable :\n• Des blessures survenant lors des matchs\n• Des conflits entre utilisateurs\n• Des pertes financières liées aux tournois\n• Des problèmes techniques temporaires' },
      { title: '11. Modifications', text: 'VS peut modifier ces conditions à tout moment. Les utilisateurs seront notifiés des changements importants. L\'utilisation continue de l\'application après modification constitue une acceptation des nouvelles conditions.' },
      { title: '12. Contact', text: 'Pour toute question concernant ces conditions, contactez-nous via l\'application ou à l\'adresse : legal@versus.com' },
      { title: '13. Droit applicable', text: 'Ces conditions sont régies par le droit ivoirien. Tout litige sera soumis aux tribunaux compétents d\'Abidjan, Côte d\'Ivoire.' },
    ],
  },
  en: {
    lastUpdated: 'Last updated: January 23, 2026',
    sections: [
      { title: '1. Acceptance of terms', text: 'By downloading, installing, or using the VS (Versus) application, you agree to be bound by these terms of use. If you do not agree with these terms, please do not use the application.' },
      { title: '2. Service description', text: 'VS is a mobile platform that allows users to:\n• Create and manage sports teams\n• Organize and join matches\n• Participate in tournaments with cash prizes\n• Book sports venues\n• Communicate with other players\n• Track their stats and performance' },
      { title: '3. Registration and account', text: 'To use VS, you must create an account. You agree to:\n• Provide accurate and up-to-date information\n• Keep your credentials confidential\n• Be at least 16 years old\n• Not create multiple accounts' },
      { title: '4. User behavior', text: 'By using VS, you agree to:\n• Respect other users\n• Not publish offensive, discriminatory, or illegal content\n• Not cheat or manipulate match results\n• Respect sportsmanship\n• Not harass other users' },
      { title: '5. Teams and matches', text: '• Team captains are responsible for managing their teams\n• Only the captain (and co-captains) can accept or reject team join requests\n• Team join requests are notified to captains and co-captains in the Notifications panel\n• Match results must be reported honestly\n• Last-minute cancellations may impact your reputation\n• The reputation system is based on behavior and reliability' },
      { title: '6. Tournaments and cash prizes', text: '• Only captains of a team with at least 5 members can create a tournament\n• Only the captain of a team can register it in a tournament; members cannot register the team\n• Tournament entry fees are non-refundable unless VS cancels the event\n• Cash prizes are distributed according to tournament rules\n• VS takes a commission on transactions\n• Winnings must be declared according to local tax laws' },
      { title: '7. Venue booking', text: '• Bookings are subject to availability\n• Cancellations are subject to venue policies\n• VS is not responsible for issues related to partner venues' },
      { title: '8. Intellectual property', text: '• Application content is protected by copyright law\n• Users retain ownership of their content but grant VS a usage license\n• Copying or reproducing the application is prohibited' },
      { title: '9. Suspension and termination', text: 'VS reserves the right to:\n• Suspend or terminate your account in case of violation\n• Remove inappropriate content\n• Modify or discontinue the service' },
      { title: '10. Limitation of liability', text: 'VS cannot be held responsible for:\n• Injuries occurring during matches\n• Conflicts between users\n• Financial losses related to tournaments\n• Temporary technical issues' },
      { title: '11. Changes', text: 'VS may modify these terms at any time. Users will be notified of important changes. Continued use of the application after changes means acceptance of the updated terms.' },
      { title: '12. Contact', text: 'For any questions regarding these terms, contact us through the app or at: legal@versus.com' },
      { title: '13. Governing law', text: 'These terms are governed by Ivorian law. Any dispute will be submitted to the competent courts of Abidjan, Côte d\'Ivoire.' },
    ],
  },
};

export default function TermsScreen() {
  const router = useRouter();
  const { locale, t } = useI18n();
  const content = locale === 'en' ? TERMS_CONTENT.en : TERMS_CONTENT.fr;
  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)/(home)' as any);
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <LinearGradient colors={[Colors.background.dark, '#0D1420']} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={handleBack}><ArrowLeft size={24} color={Colors.text.primary} /></TouchableOpacity>
            <Text style={styles.headerTitle}>{t('settings.termsOfService')}</Text>
            <View style={styles.placeholder} />
          </View>
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.lastUpdated}>{content.lastUpdated}</Text>
            {content.sections.map((section) => (
              <React.Fragment key={section.title}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
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
  lastUpdated: { color: Colors.text.muted, fontSize: 13, marginBottom: 24 },
  sectionTitle: { color: Colors.text.primary, fontSize: 16, fontWeight: '600' as const, marginTop: 24, marginBottom: 12 },
  text: { color: Colors.text.secondary, fontSize: 14, lineHeight: 22 },
  bottomSpacer: { height: 40 },
});
