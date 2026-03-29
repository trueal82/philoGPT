import {
  List,
  Datagrid,
  TextField,
  BooleanField,
  NumberField,
  EditButton,
  Create,
  Edit,
  SimpleForm,
  TextInput,
  BooleanInput,
  NumberInput,
} from 'react-admin';

export function LanguageList() {
  return (
    <List sort={{ field: 'sortOrder', order: 'ASC' }}>
      <Datagrid rowClick="edit">
        <TextField source="code" />
        <TextField source="name" />
        <TextField source="nativeName" />
        <BooleanField source="active" />
        <NumberField source="sortOrder" />
        <EditButton />
      </Datagrid>
    </List>
  );
}

function LanguageForm() {
  return (
    <>
      <TextInput source="code" />
      <TextInput source="name" fullWidth />
      <TextInput source="nativeName" fullWidth />
      <BooleanInput source="active" />
      <NumberInput source="sortOrder" />
    </>
  );
}

export function LanguageCreate() {
  return (
    <Create>
      <SimpleForm>
        <LanguageForm />
      </SimpleForm>
    </Create>
  );
}

export function LanguageEdit() {
  return (
    <Edit>
      <SimpleForm>
        <LanguageForm />
      </SimpleForm>
    </Edit>
  );
}
