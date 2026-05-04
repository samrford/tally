-- +goose Up
-- Reframe outgoings as a generic "flow" table that holds both income and
-- outgoings, distinguished by a `direction` field inside the encrypted
-- ciphertext. Server still stays oblivious to direction; this rename is
-- just to drop the misleading name.
ALTER TABLE outgoings RENAME TO flows;
ALTER INDEX outgoings_user_id_created_at RENAME TO flows_user_id_created_at;

-- +goose Down
ALTER INDEX flows_user_id_created_at RENAME TO outgoings_user_id_created_at;
ALTER TABLE flows RENAME TO outgoings;
