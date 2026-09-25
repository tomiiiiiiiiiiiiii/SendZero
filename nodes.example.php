<?php
/*
 * Copy to nodes.php on the MASTER server.
 * nodes.php is ignored by Git because it contains per-node secrets.
 *
 * "enabled" controls NEW allocations only. Set it to false when a node is
 * full, under maintenance, or its network link is saturated. Existing
 * downloads still resolve to the node.
 *
 * "weight" lets you prefer larger/faster nodes. With similar free space,
 * weight 200 receives roughly twice the preference of weight 100.
 */

return array(
    's1' => array(
        'url' => 'https://s1.sendzero.link',
        'secret' => 'REPLACE_WITH_THE_SECRET_FROM_S1',
        'enabled' => true,
        'weight' => 100
    ),

    /*
    's2' => array(
        'url' => 'https://s2.sendzero.link',
        'secret' => 'REPLACE_WITH_THE_SECRET_FROM_S2',
        'enabled' => true,
        'weight' => 100
    ),
    */
);
