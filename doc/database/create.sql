CREATE TABLE manifest
(
  id varchar(1024) PRIMARY KEY,
  parent_id varchar(1024),
  container_id varchar(1024),
  metadata json,
  type varchar(16),
  label varchar(1024),
  original_resolver varchar(1024),
  original_pronom varchar(1024),
  access_resolver varchar(1024),
  access_pronom varchar(1024),
  FOREIGN KEY (parent_id) REFERENCES manifest(id)
)