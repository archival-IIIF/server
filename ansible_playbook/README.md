# IIIF server

## Run a playbook

As a sudo user, run from the `ansible_playbook` folder:

    ansible-playbook \
        -b \
        -i environment/[name of the environment]/inventory \
        -K \
        -k \
        --tags=[tags] \
        -vv \
        playbook.yml
