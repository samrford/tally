-- +goose Up
-- The plaintext shape of outgoings ciphertext is changing from a flat
-- {amount, category, description, date} record into a discriminated union
-- of recurring + one-off entries. Old ciphertext can't be parsed by the
-- new frontend, so wipe and start fresh.
DELETE FROM outgoings;

-- +goose Down
-- Cannot restore deleted ciphertext.
