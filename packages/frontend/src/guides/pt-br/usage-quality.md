# Aba Qualidade

## Visão geral

A aba **Qualidade** é um painel que agrega os resultados de LQA (Language
Quality Assurance, garantia de qualidade linguística) produzidos sempre que
entradas são traduzidas. Ela mostra sua taxa de aprovação geral e onde os
problemas se concentram, para você encontrar áreas problemáticas rapidamente.
Ela se preenche conforme você traduz — se estiver vazia, execute uma
tradução primeiro.

## O que ela mostra

- **Taxa de aprovação geral** entre todos os resultados de LQA e as entradas
  que eles cobrem.
- **Taxa de aprovação por idioma** — qualidade por idioma de destino.
- **Problemas por origem** — contagens por tipo de problema, agrupadas por
  rótulo de origem.
- **Qualidade por módulo** — taxa de aprovação e problemas agrupados pelo
  módulo que produziu cada tradução.

## Aprofundando

Clique em qualquer célula para pular para as entradas correspondentes — o
painel filtra a tabela **Traduções** até as entradas afetadas, para você
corrigi-las.

## De onde vêm as verificações

Cada tradução passa pelo gate de LQA, que roda as verificações que você
ativou no painel *Verificações de LQA* da aba **Configuração** (igualdade de
tags, limite de comprimento, estouro, aderência ao glossário, termos
proibidos, asserções de regex e mais). Verificações **Bloqueantes** reprovam
o gate e podem disparar uma nova tentativa automática; verificações de
**Aviso** são relatadas aqui sem bloquear. Ajuste quais verificações rodam,
e sua severidade, na Configuração.
