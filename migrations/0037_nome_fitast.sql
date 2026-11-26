-- la compagnia con cui il portale FITAST conosce l'arciere: distingue gli omonimi quando si collega il nome
alter table members add column if not exists fitast_team text not null default '';
