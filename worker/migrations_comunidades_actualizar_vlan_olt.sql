-- Update communities metadata (VLAN, OLT, spelling, prefixes, and numbering ranges)

-- AMOJILECA (ID 1)
UPDATE comunidades SET prefijo = 'AML', vlan = 200, olt_ip = NULL WHERE id = 1;

-- AMEYALTEPEC (ID 2)
UPDATE comunidades SET prefijo = 'AMP', vlan = 61, olt_ip = '172.18.1.26' WHERE id = 2;

-- LLANO GRANDE (ID 3)
UPDATE comunidades SET prefijo = 'LLG', vlan = 10, olt_ip = NULL WHERE id = 3;

-- SAN AGUSTIN OAPAN (ID 4)
UPDATE comunidades SET prefijo = 'SAO', vlan = 53, olt_ip = '172.18.1.54' WHERE id = 4;

-- SAN FRANCISCO OZOMATLAN (ID 5)
UPDATE comunidades SET prefijo = 'SFO', vlan = 58, olt_ip = '172.18.1.82' WHERE id = 5;

-- SAN JUAN TETELCINGO (ID 6)
-- Note: keep siguiente_numero_cliente = 6001 because it has generated clients (siguiente_numero_cliente > 5000)
UPDATE comunidades SET prefijo = 'SJT', vlan = 52, olt_ip = '172.18.1.38', numero_inicial_cliente = 5000 WHERE id = 6;

-- SAN MARCOS (ID 7)
-- Note: keep siguiente_numero_cliente = 6072 because it has generated clients (siguiente_numero_cliente > 6000)
UPDATE comunidades SET nombre = 'SAN MARCOS OACATZINGO', prefijo = 'SMC', vlan = 55, olt_ip = '172.18.1.50' WHERE id = 7;

-- SAN MIGUEL TECUIPAN (ID 8)
UPDATE comunidades SET nombre = 'SAN MIGUEL TECUICIAPAN', prefijo = 'SMT', vlan = 57, olt_ip = '172.18.1.70' WHERE id = 8;

-- TLAMAMACAN (ID 9)
UPDATE comunidades SET prefijo = 'TMM', vlan = 54, olt_ip = '172.18.1.42' WHERE id = 9;

-- TONALAPAN (ID 10)
UPDATE comunidades SET nombre = 'TONALAPA', prefijo = 'TNL', vlan = 50, olt_ip = '172.18.1.2' WHERE id = 10;

-- VENTA PALULA (ID 11)
UPDATE comunidades SET nombre = 'VENTA DE PALULA', prefijo = 'VDP', vlan = 50, olt_ip = NULL WHERE id = 11;

-- XALITLA (ID 12)
UPDATE comunidades SET prefijo = 'XAL', vlan = 51, olt_ip = '172.18.1.14' WHERE id = 12;

-- SAN JUAN TOTOLCINTLA (ID 13) -> SAN JUAN TOTOLCINGA
-- Note: siguiente_numero_cliente updated to 15000 since no clients are generated yet (it was 5000)
UPDATE comunidades SET nombre = 'SAN JUAN TOTOLCINGA', prefijo = 'STT', vlan = 60, olt_ip = NULL, numero_inicial_cliente = 15000, siguiente_numero_cliente = 15000 WHERE id = 13;

-- PALULA (ID 14)
UPDATE comunidades SET prefijo = 'PLL', vlan = 64, olt_ip = NULL WHERE id = 14;

-- TULA (ID 16)
UPDATE comunidades SET prefijo = 'TUL', vlan = 59, olt_ip = '172.18.1.78', numero_inicial_cliente = 13000, siguiente_numero_cliente = 13000 WHERE id = 16;

-- SAN AGUSTIN OSTOTIPAN (ID 17)
-- Note: prefix kept as 'SSS' to prevent duplicate 'SAO' collision
UPDATE comunidades SET vlan = 62, olt_ip = '172.18.1.54' WHERE id = 17;

-- ATETETLA (ID 18)
UPDATE comunidades SET vlan = NULL, olt_ip = NULL, numero_inicial_cliente = 18000, siguiente_numero_cliente = 18000 WHERE id = 18;

-- COEXCONCLAN (ID 20)
UPDATE comunidades SET vlan = NULL, olt_ip = '172.18.1.54', numero_inicial_cliente = 17000, siguiente_numero_cliente = 17000 WHERE id = 20;
