ALTER TABLE persons ADD COLUMN gender ENUM('m', 'f', 'd') NULL AFTER last_name;

CREATE TABLE IF NOT EXISTS tenant_texts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  event_id INT NOT NULL,
  text_key VARCHAR(100) NOT NULL,
  text_value TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  UNIQUE KEY (tenant_id, event_id, text_key)
);
