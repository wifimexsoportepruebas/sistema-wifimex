-- Migration to add vlan and olt_ip columns to comunidades table
ALTER TABLE comunidades ADD COLUMN vlan INTEGER;
ALTER TABLE comunidades ADD COLUMN olt_ip TEXT;
