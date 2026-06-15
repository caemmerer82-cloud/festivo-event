-- Event Manager Database Schema
-- MariaDB / MySQL compatible

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS mail_log;
DROP TABLE IF EXISTS guest_answers;
DROP TABLE IF EXISTS event_guests;
DROP TABLE IF EXISTS event_questions;
DROP TABLE IF EXISTS events;
DROP TABLE IF EXISTS persons;
DROP TABLE IF EXISTS mail_templates;
DROP TABLE IF EXISTS tenant_smtp;
DROP TABLE IF EXISTS tenant_users;
DROP TABLE IF EXISTS tenants;
DROP TABLE IF EXISTS system_admins;
SET FOREIGN_KEY_CHECKS = 1;

-- System admins (completely separate from tenants)
CREATE TABLE system_admins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tenants
CREATE TABLE tenants (
  id INT AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE
);

-- Tenant users (admins and regular users)
CREATE TABLE tenant_users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  username VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  is_admin BOOLEAN DEFAULT FALSE,
  perm_create_users BOOLEAN DEFAULT FALSE,
  perm_create_persons BOOLEAN DEFAULT FALSE,
  perm_create_events BOOLEAN DEFAULT FALSE,
  perm_set_status BOOLEAN DEFAULT FALSE,
  perm_create_mails BOOLEAN DEFAULT FALSE,
  perm_send_mails BOOLEAN DEFAULT FALSE,
  perm_create_rsvp BOOLEAN DEFAULT FALSE,
  perm_edit_rsvp BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  UNIQUE KEY (tenant_id, username)
);

-- SMTP configuration per tenant
CREATE TABLE tenant_smtp (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL UNIQUE,
  host VARCHAR(255) NOT NULL,
  port INT NOT NULL DEFAULT 587,
  username VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL,
  encryption ENUM('tls', 'ssl', 'none') DEFAULT 'tls',
  from_email VARCHAR(255) NOT NULL,
  from_name VARCHAR(255) NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Persons (guests) per tenant
CREATE TABLE persons (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  UNIQUE KEY (tenant_id, email)
);

-- Events per tenant
CREATE TABLE events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  location VARCHAR(255),
  event_date DATETIME NOT NULL,
  banner_path VARCHAR(500),
  attachment_path VARCHAR(500),
  attachment_filename VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- RSVP questions per event
CREATE TABLE event_questions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_id INT NOT NULL,
  question_text TEXT NOT NULL,
  question_type ENUM('text', 'dropdown', 'radio', 'checkbox') NOT NULL,
  options JSON,
  is_required BOOLEAN DEFAULT FALSE,
  sort_order INT DEFAULT 0,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

-- Junction: persons invited to events
CREATE TABLE event_guests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_id INT NOT NULL,
  person_id INT NOT NULL,
  status ENUM('angelegt', 'eingeladen', 'zugesagt', 'abgesagt') DEFAULT 'angelegt',
  invitation_token VARCHAR(64) UNIQUE,
  token_expires_at TIMESTAMP NULL,
  invited_at TIMESTAMP NULL,
  responded_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE CASCADE,
  UNIQUE KEY (event_id, person_id)
);

-- Answers to RSVP questions
CREATE TABLE guest_answers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_guest_id INT NOT NULL,
  question_id INT NOT NULL,
  answer TEXT,
  FOREIGN KEY (event_guest_id) REFERENCES event_guests(id) ON DELETE CASCADE,
  FOREIGN KEY (question_id) REFERENCES event_questions(id) ON DELETE CASCADE
);

-- Mail templates per tenant
CREATE TABLE mail_templates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  subject VARCHAR(500) NOT NULL,
  body_html TEXT NOT NULL,
  include_attachment BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Mail send log
CREATE TABLE mail_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  event_id INT,
  person_id INT,
  template_id INT,
  recipient_email VARCHAR(255) NOT NULL,
  subject VARCHAR(500) NOT NULL,
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status ENUM('sent', 'failed') DEFAULT 'sent',
  error_message TEXT,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Default system admin (password: password - change immediately!)
INSERT INTO system_admins (username, password_hash) VALUES
('admin', '$2y$12$WibyY5KiqkeazcGHGCVIE.YT/u.Yrg65Khv0SNcTw4SOhzGET6Kku');
