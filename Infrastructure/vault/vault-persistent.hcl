storage "raft" {
  path    = "/openbao/file"
  node_id = "auction-vault-1"
}

listener "tcp" {
  address     = "0.0.0.0:8200"
  tls_disable = true
}

api_addr      = "http://vault:8200"
cluster_addr  = "https://vault:8201"
disable_mlock = true
ui            = true
