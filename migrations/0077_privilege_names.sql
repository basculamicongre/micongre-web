-- Nombres más cortos de los privilegios: la ficha y la asignación masiva ya los muestran agrupados («Administrar», «Administrar por
-- grupo», «Reuniones»…, lib/rbac/privilegeGroups.ts), así que el nombre ya no repite el verbo ni el formulario. Solo cambia `name`;
-- los códigos, ids y categorías siguen iguales.
UPDATE privileges SET name = 'Cuentas de usuarios' WHERE id = 'priv_accounts_admin';
UPDATE privileges SET name = 'Acomodadores' WHERE id = 'priv_operational_access';
UPDATE privileges SET name = 'Limpieza' WHERE id = 'priv_cleaning_admin';
UPDATE privileges SET name = 'Tablero de pastoreo' WHERE id = 'priv_pastoral_care';
UPDATE privileges SET name = 'Contingencias' WHERE id = 'priv_disaster_access';
UPDATE privileges SET name = 'Recolección de informes de servicio' WHERE id = 'priv_field_service_reports';
UPDATE privileges SET name = 'Registro de asistencia' WHERE id = 'priv_meeting_attendance';
UPDATE privileges SET name = 'Territorios' WHERE id = 'priv_territory_management';
UPDATE privileges SET name = 'Predicación' WHERE id = 'priv_preaching_admin';
UPDATE privileges SET name = 'Reuniones de entre semana' WHERE id = 'priv_midweek_access';
UPDATE privileges SET name = 'Reuniones de fin de semana' WHERE id = 'priv_weekend_access';
UPDATE privileges SET name = 'Acceso como superintendente de circuito' WHERE id = 'priv_co_visit_access';
UPDATE privileges SET name = 'Partes en Nuestra vida cristiana' WHERE id = 'priv_christian_living';
