import { StyleSheet, Text, View } from 'react-native';

/**
 * Exibe o contexto atual do app (empreendimento, cliente, unidade, título da tela)
 * Pode ser usado no topo de qualquer tela para navegação semântica e contexto.
 */
export default function HeaderContextual({
  title,
  titulo,
  empreendimento,
  cliente,
  unidade,
  leftButton,
  rightContent,
  children
}) {
  // Permite usar tanto 'title' quanto 'titulo' para compatibilidade
  const displayTitle = title || titulo;
  return (
    <View style={styles.container}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {leftButton ? <View style={{ marginRight: 8 }}>{leftButton}</View> : <View />}
        <View style={{ flex: 1 }}>
          <View style={styles.breadcrumbRow}>
            {empreendimento ? (
              <Text style={styles.breadcrumbText}>
                {empreendimento}
                {cliente ? <Text style={styles.breadcrumbSub}> • {cliente}</Text> : null}
                {unidade ? <Text style={styles.breadcrumbSub}> • Unidade {unidade}</Text> : null}
              </Text>
            ) : null}
          </View>
          <Text style={styles.titulo}>{displayTitle}</Text>
        </View>
        {rightContent ? <View style={{ marginLeft: 8 }}>{rightContent}</View> : <View />}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    marginBottom: 8,
  },
  breadcrumbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  breadcrumbText: {
    color: '#666',
    fontSize: 13,
    fontWeight: '500',
  },
  breadcrumbSub: {
    color: '#999',
    fontSize: 13,
    fontWeight: '400',
  },
  titulo: {
    fontSize: 18,
    fontWeight: '700',
    color: '#222',
    marginBottom: 2,
  },
});
