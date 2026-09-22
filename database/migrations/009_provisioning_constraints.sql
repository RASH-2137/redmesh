-- A single access request can produce at most one provisioning record.
CREATE UNIQUE INDEX provisioning_records_access_request_unique
ON provisioning_records(access_request_id);