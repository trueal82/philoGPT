import {
  List,
  Datagrid,
  TextField,
  BooleanField,
  EditButton,
  Create,
  Edit,
  SimpleForm,
  TextInput,
  SelectInput,
  NumberInput,
  BooleanInput,
} from 'react-admin';

const providerChoices = [
  { id: 'openai', name: 'OpenAI' },
  { id: 'ollama', name: 'Ollama' },
  { id: 'huggingface', name: 'HuggingFace' },
  { id: 'custom', name: 'Custom' },
];

export function LlmConfigList() {
  return (
    <List sort={{ field: 'createdAt', order: 'DESC' }}>
      <Datagrid rowClick="edit">
        <TextField source="name" />
        <TextField source="provider" />
        <TextField source="model" />
        <BooleanField source="isActive" />
        <BooleanField source="supportsTools" />
        <EditButton />
      </Datagrid>
    </List>
  );
}

function LlmConfigForm() {
  return (
    <>
      <TextInput source="name" fullWidth />
      <SelectInput source="provider" choices={providerChoices} />
      <TextInput source="apiKey" label="API Key (leave blank to keep current)" fullWidth />
      <TextInput source="apiUrl" fullWidth />
      <TextInput source="model" fullWidth />
      <BooleanInput source="isActive" />
      <NumberInput source="temperature" />
      <NumberInput source="maxTokens" />
      <NumberInput source="topP" />
      <NumberInput source="frequencyPenalty" />
      <NumberInput source="presencePenalty" />
      <BooleanInput source="supportsTools" />
    </>
  );
}

export function LlmConfigCreate() {
  return (
    <Create>
      <SimpleForm>
        <LlmConfigForm />
      </SimpleForm>
    </Create>
  );
}

export function LlmConfigEdit() {
  return (
    <Edit>
      <SimpleForm>
        <LlmConfigForm />
      </SimpleForm>
    </Edit>
  );
}
