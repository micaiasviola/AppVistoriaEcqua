App Vistoria — Web (isolado)

Este projeto é um scaffold mínimo da interface web criado de forma isolada em `web-app/`.
Ele não modifica nem afeta o código mobile existente — é um app separado com dependências próprias.

Como rodar:

1. Entre na pasta:

```bash
cd web-app
```

2. Instale dependências:

```bash
npm install
```

3. Rode em desenvolvimento:

```bash
npm run dev
```

Arquitetura proposta:
- `web-app/` — app React + Vite isolado
- Quando quiser integrar componentes compartilhados, mover partes para `src/shared/` e criar adaptações específicas para mobile/web.

Próximos passos sugeridos:
- Conectar APIs/Supabase para buscar dados reais
- Implementar formulário de edição web (salvar/excluir)
- Adicionar autenticação/estrutura de rotas avançada
