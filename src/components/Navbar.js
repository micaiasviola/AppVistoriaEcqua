import { Image, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function Navbar() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.content}>
        {/* LOGO DA EMPRESA */}
        <Image 
          source={require('../../assets/images/logo.png')} 
          style={styles.logo} 
          resizeMode="contain" 
        />
        
        {/* TÍTULO */}
        <View style={styles.textContainer}>
          <Text style={styles.title}>Sistemas de Vistorias</Text>
          <Text style={styles.subtitle}>ECQUA</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute', // Faz ficar sobreposta
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100, // Garante que fique acima de tudo
    backgroundColor: 'rgba(255, 255, 255, 0.95)', // Fundo branco levemente transparente
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    // Sombra para dar destaque
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  content: {
    flexDirection: 'row', // Horizontal
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    paddingTop: 8, // Ajuste fino
    height: 60, // Altura fixa da área de conteúdo
  },
  logo: {
    width: 40, 
    height: 40,
    marginRight: 12,
  },
  textContainer: {
    flexDirection: 'column',
  },
  title: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 18,
    color: '#007AFF', // Azul padrão (pode mudar para a cor da sua logo)
    fontWeight: '900',
    marginTop: -2,
  }
});