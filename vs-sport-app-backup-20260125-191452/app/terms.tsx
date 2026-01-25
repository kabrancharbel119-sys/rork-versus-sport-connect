import React from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { Colors } from '@/constants/colors';

export default function TermsScreen() {
  const router = useRouter();

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <LinearGradient colors={[Colors.background.dark, '#0D1420']} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}><ArrowLeft size={24} color={Colors.text.primary} /></TouchableOpacity>
            <Text style={styles.headerTitle}>Conditions d{"'"}utilisation</Text>
            <View style={styles.placeholder} />
          </View>
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.lastUpdated}>Dernière mise à jour : 23 janvier 2026</Text>
            
            <Text style={styles.sectionTitle}>1. Acceptation des conditions</Text>
            <Text style={styles.text}>En téléchargeant, installant ou utilisant l{"'"}application VS (Versus), vous acceptez d{"'"}être lié par les présentes conditions d{"'"}utilisation. Si vous n{"'"}acceptez pas ces conditions, veuillez ne pas utiliser l{"'"}application.</Text>

            <Text style={styles.sectionTitle}>2. Description du service</Text>
            <Text style={styles.text}>VS est une plateforme mobile permettant aux utilisateurs de :{'\n'}• Créer et gérer des équipes sportives{'\n'}• Organiser et participer à des matchs{'\n'}• Participer à des tournois avec cash prizes{'\n'}• Réserver des terrains sportifs{'\n'}• Communiquer avec d{"'"}autres joueurs{'\n'}• Suivre leurs statistiques et performances</Text>

            <Text style={styles.sectionTitle}>3. Inscription et compte</Text>
            <Text style={styles.text}>Pour utiliser VS, vous devez créer un compte. Vous vous engagez à :{'\n'}• Fournir des informations exactes et à jour{'\n'}• Maintenir la confidentialité de vos identifiants{'\n'}• Être âgé d{"'"}au moins 16 ans{'\n'}• Ne pas créer plusieurs comptes</Text>

            <Text style={styles.sectionTitle}>4. Comportement des utilisateurs</Text>
            <Text style={styles.text}>En utilisant VS, vous vous engagez à :{'\n'}• Respecter les autres utilisateurs{'\n'}• Ne pas publier de contenu offensant, discriminatoire ou illégal{'\n'}• Ne pas tricher ou manipuler les résultats des matchs{'\n'}• Respecter le fair-play sportif{'\n'}• Ne pas harceler d{"'"}autres utilisateurs</Text>

            <Text style={styles.sectionTitle}>5. Équipes et matchs</Text>
            <Text style={styles.text}>• Les capitaines d{"'"}équipe sont responsables de la gestion de leur équipe{'\n'}• Les résultats des matchs doivent être reportés honnêtement{'\n'}• Les annulations de dernière minute peuvent affecter votre réputation{'\n'}• Le système de réputation est basé sur le comportement et la fiabilité</Text>

            <Text style={styles.sectionTitle}>6. Tournois et cash prizes</Text>
            <Text style={styles.text}>• Les frais d{"'"}inscription aux tournois sont non remboursables sauf annulation par VS{'\n'}• Les cash prizes sont distribués selon les règles du tournoi{'\n'}• VS prélève une commission sur les transactions{'\n'}• Les gains doivent être déclarés selon les lois fiscales locales</Text>

            <Text style={styles.sectionTitle}>7. Réservation de terrains</Text>
            <Text style={styles.text}>• Les réservations sont soumises à disponibilité{'\n'}• Les annulations sont soumises aux politiques des terrains{'\n'}• VS n{"'"}est pas responsable des problèmes liés aux terrains partenaires</Text>

            <Text style={styles.sectionTitle}>8. Propriété intellectuelle</Text>
            <Text style={styles.text}>• Le contenu de l{"'"}application est protégé par le droit d{"'"}auteur{'\n'}• Les utilisateurs conservent la propriété de leur contenu mais accordent à VS une licence d{"'"}utilisation{'\n'}• Il est interdit de copier ou reproduire l{"'"}application</Text>

            <Text style={styles.sectionTitle}>9. Suspension et résiliation</Text>
            <Text style={styles.text}>VS se réserve le droit de :{'\n'}• Suspendre ou résilier votre compte en cas de violation{'\n'}• Supprimer du contenu inapproprié{'\n'}• Modifier ou interrompre le service</Text>

            <Text style={styles.sectionTitle}>10. Limitation de responsabilité</Text>
            <Text style={styles.text}>VS ne peut être tenu responsable :{'\n'}• Des blessures survenant lors des matchs{'\n'}• Des conflits entre utilisateurs{'\n'}• Des pertes financières liées aux tournois{'\n'}• Des problèmes techniques temporaires</Text>

            <Text style={styles.sectionTitle}>11. Modifications</Text>
            <Text style={styles.text}>VS peut modifier ces conditions à tout moment. Les utilisateurs seront notifiés des changements importants. L{"'"}utilisation continue de l{"'"}application après modification constitue une acceptation des nouvelles conditions.</Text>

            <Text style={styles.sectionTitle}>12. Contact</Text>
            <Text style={styles.text}>Pour toute question concernant ces conditions, contactez-nous via l{"'"}application ou à l{"'"}adresse : legal@versus.com</Text>

            <Text style={styles.sectionTitle}>13. Droit applicable</Text>
            <Text style={styles.text}>Ces conditions sont régies par le droit ivoirien. Tout litige sera soumis aux tribunaux compétents d{"'"}Abidjan, Côte d{"'"}Ivoire.</Text>

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
