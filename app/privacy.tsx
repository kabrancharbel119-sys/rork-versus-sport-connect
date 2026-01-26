import React from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { Colors } from '@/constants/colors';

export default function PrivacyScreen() {
  const router = useRouter();

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <LinearGradient colors={[Colors.background.dark, '#0D1420']} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}><ArrowLeft size={24} color={Colors.text.primary} /></TouchableOpacity>
            <Text style={styles.headerTitle}>Politique de confidentialité</Text>
            <View style={styles.placeholder} />
          </View>
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.lastUpdated}>Dernière mise à jour : 23 janvier 2026</Text>

            <Text style={styles.intro}>VS (Versus) s{"'"}engage à protéger votre vie privée. Cette politique explique comment nous collectons, utilisons et protégeons vos données personnelles.</Text>

            <Text style={styles.sectionTitle}>1. Données collectées</Text>
            <Text style={styles.subtitle}>Informations fournies par l{"'"}utilisateur :</Text>
            <Text style={styles.text}>• Nom, prénom, nom d{"'"}utilisateur{'\n'}• Adresse email et numéro de téléphone{'\n'}• Photo de profil{'\n'}• Ville et pays de résidence{'\n'}• Informations sportives (sports pratiqués, niveau, position){'\n'}• Disponibilités</Text>
            
            <Text style={styles.subtitle}>Informations collectées automatiquement :</Text>
            <Text style={styles.text}>• Données de localisation (avec votre consentement){'\n'}• Statistiques d{"'"}utilisation de l{"'"}application{'\n'}• Informations sur l{"'"}appareil{'\n'}• Historique des matchs et performances</Text>

            <Text style={styles.sectionTitle}>2. Utilisation des données</Text>
            <Text style={styles.text}>Nous utilisons vos données pour :{'\n'}• Créer et gérer votre compte{'\n'}• Faciliter la création d{"'"}équipes et de matchs{'\n'}• Gérer les demandes à rejoindre les équipes (notifications aux capitaines et co-capitaines){'\n'}• Vérifier l’éligibilité à la création de tournois (capitaine d’équipe d’au moins 5 membres) et aux inscriptions (capitaine uniquement){'\n'}• Calculer vos statistiques et réputation{'\n'}• Vous connecter avec d{"'"}autres joueurs dans votre zone{'\n'}• Envoyer des notifications pertinentes (annonces, demandes d’équipe, etc.){'\n'}• Améliorer nos services{'\n'}• Prévenir la fraude et assurer la sécurité</Text>

            <Text style={styles.sectionTitle}>3. Partage des données</Text>
            <Text style={styles.text}>Vos données peuvent être partagées avec :{'\n'}• Les autres utilisateurs (profil public){'\n'}• Les membres de vos équipes{'\n'}• Les organisateurs de tournois{'\n'}• Nos partenaires terrains (pour les réservations){'\n'}• Les autorités si requis par la loi</Text>
            <Text style={styles.text}>Nous ne vendons jamais vos données personnelles à des tiers.</Text>

            <Text style={styles.sectionTitle}>4. Données de localisation</Text>
            <Text style={styles.text}>La localisation est utilisée pour :{'\n'}• Trouver des matchs et joueurs proches{'\n'}• Afficher les terrains disponibles{'\n'}• Calculer les distances pour les matchs{'\n'}{'\n'}Vous pouvez désactiver la localisation dans les paramètres, mais certaines fonctionnalités seront limitées.</Text>

            <Text style={styles.sectionTitle}>5. Sécurité des données</Text>
            <Text style={styles.text}>Nous protégeons vos données par :{'\n'}• Chiffrement des données sensibles{'\n'}• Stockage sécurisé{'\n'}• Accès restreint aux employés autorisés{'\n'}• Surveillance des activités suspectes</Text>

            <Text style={styles.sectionTitle}>6. Conservation des données</Text>
            <Text style={styles.text}>Vos données sont conservées tant que votre compte est actif. Après suppression du compte, certaines données peuvent être conservées pour des raisons légales ou de sécurité pendant une période limitée.</Text>

            <Text style={styles.sectionTitle}>7. Vos droits</Text>
            <Text style={styles.text}>Vous avez le droit de :{'\n'}• Accéder à vos données personnelles{'\n'}• Corriger des informations inexactes{'\n'}• Demander la suppression de vos données{'\n'}• Retirer votre consentement{'\n'}• Exporter vos données{'\n'}{'\n'}Pour exercer ces droits, contactez-nous via l{"'"}application.</Text>

            <Text style={styles.sectionTitle}>8. Cookies et technologies similaires</Text>
            <Text style={styles.text}>Nous utilisons des technologies de suivi pour améliorer votre expérience et analyser l{"'"}utilisation de l{"'"}application. Vous pouvez gérer ces préférences dans les paramètres.</Text>

            <Text style={styles.sectionTitle}>9. Mineurs</Text>
            <Text style={styles.text}>VS est destiné aux utilisateurs de 16 ans et plus. Nous ne collectons pas sciemment de données sur les enfants de moins de 16 ans.</Text>

            <Text style={styles.sectionTitle}>10. Modifications</Text>
            <Text style={styles.text}>Cette politique peut être mise à jour. Les modifications importantes vous seront notifiées par email ou via l{"'"}application.</Text>

            <Text style={styles.sectionTitle}>11. Contact</Text>
            <Text style={styles.text}>Pour toute question concernant vos données personnelles :{'\n'}{'\n'}Email : privacy@versus.com{'\n'}Via l{"'"}application : Réglages → Nous contacter</Text>

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
