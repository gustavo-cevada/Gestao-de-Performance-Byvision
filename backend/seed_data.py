"""Metas iniciais por cliente (cod_cliente -> meta em R$).

Extraidas da planilha base do vendedor VAGNER. A soma corresponde a
R$ 100.368,00 (meta mensal). O admin pode alterar essas metas no painel.
Metas de grupos (celulas mescladas na planilha) foram atribuidas ao cliente
principal do grupo.
"""

METAS_SEED: dict[str, float] = {
    "3971": 3752.0,
    "5017": 6000.0,
    "5399": 3000.0,
    "5084": 2000.0,
    "6904": 1223.0,
    "6743": 1900.0,
    "5068": 2500.0,
    "4011": 1500.0,
    "5153": 3000.0,
    "7510": 1493.0,
    "5309": 1000.0,
    "6404": 12000.0,
    "7377": 7500.0,
    "5220": 3000.0,
    "2628": 15000.0,  # grupo OTICA SAO BERNARDO (6618/2628/6203)
    "5229": 1000.0,
    "561": 2000.0,
    "2629": 2000.0,
    "6684": 2500.0,
    "7009": 12000.0,
    "5221": 1000.0,
    "5168": 3000.0,   # grupo NOVA ERA / OTICA VISAO (5167/5168/5164)
    "5338": 2500.0,
    "5341": 2500.0,
    "5342": 2500.0,
    "5169": 2500.0,
    "4369": 2000.0,   # grupo OTICA CESAR BRAGA (4364/4369/4370)
}
