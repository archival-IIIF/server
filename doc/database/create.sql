CREATE TABLE items
(
  id varchar(1024) PRIMARY KEY,
  parent_id varchar(1024) NULL,
  container_id varchar(1024) NOT NULL,
  metadata json NULL,
  type varchar(16) NOT NULL,
  label varchar(1024) NOT NULL,
  size bigint NULL,
  created_at date NULL,
  width int NULL,
  height int NULL,
  original_resolver varchar(1024) NULL,
  original_pronom varchar(1024) NULL,
  access_resolver varchar(1024) NULL,
  access_pronom varchar(1024) NULL,
  FOREIGN KEY (parent_id) REFERENCES items(id)
);

CREATE TABLE tokens
(
  token varchar(1024) PRIMARY KEY,
  container_id varchar(1024) NOT NULL,
  "from" date NULL,
  "to" date NULL
);
